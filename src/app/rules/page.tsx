import { readFile } from 'fs/promises'
import path from 'path'

export default async function RulesPage() {
  // Read game-rules.md from the repo
  const filePath = path.join(process.cwd(), 'docs', 'game-rules.md')
  const content = await readFile(filePath, 'utf-8')

  // Simple markdown-to-html: split by double newlines for paragraphs,
  // handle headings and basic formatting
  const sections = content.split('\n\n')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <article className="prose prose-zinc dark:prose-invert max-w-none">
        {sections.map((section, i) => {
          const trimmed = section.trim()
          if (!trimmed) return null

          // Check if it's a heading (line on its own without prefix)
          const lines = trimmed.split('\n')

          // First line of the file = main title
          if (i === 0) {
            return (
              <h1 key={i} className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {trimmed}
              </h1>
            )
          }

          // Single short line = section heading
          if (lines.length === 1 && trimmed.length < 60 && !trimmed.includes('.')) {
            return (
              <h2
                key={i}
                className="mb-3 mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
              >
                {trimmed}
              </h2>
            )
          }

          // Otherwise it's a paragraph
          return (
            <p key={i} className="mb-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {lines.map((line, j) => (
                <span key={j}>
                  {line}
                  {j < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          )
        })}
      </article>
    </div>
  )
}
