/** Safe category display values with fallback for missing / archived categories */
export function catDisplay(cat: { name: string; color: string; icon: string | null } | null | undefined) {
  return {
    name: cat?.name ?? '未分类',
    color: cat?.color ?? '#6b7280',
    icon: cat?.icon ?? null,
  };
}
