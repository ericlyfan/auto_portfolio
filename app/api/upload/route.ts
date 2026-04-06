import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { extractFujiRecipe } from "@/lib/exif";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILES = 10;

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: "Maximum 10 images allowed" },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }
  }

  const imagePaths: string[] = [];
  const recipes: (string | null)[] = [];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${Date.now()}-${path.basename(file.name)}`;
    const uploadPath = path.join(process.cwd(), "public", "uploads", filename);

    await fs.writeFile(uploadPath, buffer);

    const imagePath = `/uploads/${filename}`;
    imagePaths.push(imagePath);

    const recipe = await extractFujiRecipe(uploadPath);
    recipes.push(recipe);
  }

  // Determine primary recipe (first non-null)
  const primaryRecipe = recipes.find((r) => r !== null) ?? null;

  // Find mismatched images
  const mismatchedImages: { index: number; recipe: string }[] = [];
  if (primaryRecipe) {
    for (let i = 0; i < recipes.length; i++) {
      if (recipes[i] !== null && recipes[i] !== primaryRecipe) {
        mismatchedImages.push({ index: i, recipe: recipes[i]! });
      }
    }
  }

  return NextResponse.json({
    imagePaths,
    recipes,
    primaryRecipe,
    mismatchedImages,
  });
}
