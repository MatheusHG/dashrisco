/**
 * Parsing centralizado do campo `imageUrl` de TaskComment.
 *
 * Histórico do schema:
 *   - Antes do MOD-03 (≤ 2026-04-15): comentários com 1 imagem salvavam o path
 *     diretamente como string (ex: "comments/abc.png").
 *   - Depois do MOD-03: comentários salvam JSON array (ex: '["comments/a.png","comments/b.png"]')
 *     mesmo quando há só 1 imagem (em alguns fluxos).
 *
 * Use SEMPRE este helper ao renderizar imagens de comentários.
 * Não duplique a lógica em pages — toda regressão de display de imagem
 * antiga (bug em 2026-04-XX) veio de páginas que não tratavam ambos formatos.
 */
export function parseCommentImageUrls(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) return [];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
  try {
    const paths: string[] = imageUrl.startsWith("[")
      ? JSON.parse(imageUrl)
      : [imageUrl];
    return paths.map((p) => `${apiUrl}/uploads/${p}`);
  } catch {
    // Defensivo: se JSON.parse falhar (imageUrl mal-formado), trata como path único.
    return [`${apiUrl}/uploads/${imageUrl}`];
  }
}
