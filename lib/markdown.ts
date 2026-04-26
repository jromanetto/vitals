export function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-medium mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-8 mb-3 text-emerald">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-semibold mt-2 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-muted-foreground">$1</em>')
    .replace(/\`([^\`]+)\`/g, '<code class="px-1 py-0.5 rounded bg-secondary text-emerald text-[0.85em]">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc leading-relaxed">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal leading-relaxed">$2</li>')
    .replace(/(<li[\s\S]*?<\/li>\s*)+/g, '<ul class="space-y-1 my-3">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>');
}
