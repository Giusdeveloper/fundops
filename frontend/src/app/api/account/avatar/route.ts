import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const BUCKET = "profile-avatars";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return json(401, { error: "Unauthorized" });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return json(400, { error: "File mancante" });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return json(400, { error: "Formato immagine non supportato" });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return json(400, { error: "La foto profilo deve essere sotto i 5MB" });
  }

  const arrayBuffer = await file.arrayBuffer();
  const filePath = `${user.id}/avatar`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, arrayBuffer, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return json(500, { error: uploadError.message });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  const avatarUrl = `${publicUrl}?v=${Date.now()}`;
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) {
    return json(500, { error: profileError.message });
  }

  return json(200, { avatarUrl });
}
