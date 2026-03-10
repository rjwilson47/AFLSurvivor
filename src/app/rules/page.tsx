import { readFile } from 'fs/promises'
import path from 'path'
import Link from 'next/link'

export default async function RulesPage() {
  const filePath = path.join(process.cwd(), 'docs', 'game-rules.md')
  const content = await readFile(filePath, 'utf-8')

  // Parse markdown into sections split by double newlines
  const sections = content.split('\n\n')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
      >
        &larr; Back to Leaderboard
      </Link>

      <article>
        {sections.map((section, i) => {
          const trimmed = section.trim()
          if (!trimmed) return null

          const lines = trimmed.split('\n')

          // First section = main title
          if (i === 0) {
            return (
              <h1
                key={i}
                className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-50"
              >
                {trimmed}
              </h1>
            )
          }

          // Single short line = section heading
          if (lines.length === 1 && trimmed.length < 60 && !trimmed.includes('.')) {
            return (
              <h2
                key={i}
                className="mb-2 mt-8 border-b border-zinc-200 pb-2 text-base font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
              >
                {trimmed}
              </h2>
            )
          }

          // Multi-line paragraph — first line may be a sub-heading if short
          const firstLine = lines[0].trim()
          const rest = lines.slice(1)
          const firstLineIsSubheading =
            lines.length > 1 &&
            firstLine.length < 80 &&
            firstLine.endsWith(':')

          if (firstLineIsSubheading) {
            return (
              <div key={i} className="mb-4">
                <p className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {firstLine}
                </p>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {rest.map((line, j) => (
                    <span key={j}>
                      {line.trim()}
                      {j < rest.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              </div>
            )
          }

          // Regular paragraph
          return (
            <p
              key={i}
              className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            >
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
