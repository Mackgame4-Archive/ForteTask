"use client"

import * as React from "react"
import {
  Bold,
  Code,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  List,
  Pencil,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type MarkdownEditorProps = Omit<
  React.ComponentProps<"textarea">,
  "children" | "defaultValue" | "value" | "onChange"
> & {
  defaultValue?: string | null
  defaultPreview?: boolean
}

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (value: string) => void,
  before: string,
  after = before,
  placeholder = "text"
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)
  const content = selected || placeholder
  const nextValue =
    value.slice(0, start) + before + content + after + value.slice(end)

  setValue(nextValue)

  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(
      start + before.length,
      start + before.length + content.length
    )
  })
}

function getSafeHref(href: string) {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:")
  ) {
    return href
  }

  return "#"
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function renderInlineMarkdownHtml(text: string) {
  const parts = text.split(
    /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  )

  return parts
    .map((part) => {
      if (part.startsWith("***") && part.endsWith("***")) {
        return `<strong><em>${escapeHtml(part.slice(3, -3))}</em></strong>`
      }

      if (part.startsWith("**") && part.endsWith("**")) {
        return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`
      }

      if (part.startsWith("*") && part.endsWith("*")) {
        return `<em>${escapeHtml(part.slice(1, -1))}</em>`
      }

      if (part.startsWith("`") && part.endsWith("`")) {
        return `<code class="bg-muted px-1 py-0.5 text-[0.8em]">${escapeHtml(part.slice(1, -1))}</code>`
      }

      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)

      if (link) {
        const label = escapeHtml(link[1] ?? "")
        const href = escapeHtml(getSafeHref(link[2] ?? ""))

        return `<a href="${href}" target="_blank" rel="noreferrer" class="text-primary underline underline-offset-2">${label}</a>`
      }

      return escapeHtml(part)
    })
    .join("")
}

function markdownToHtml(value: string) {
  const lines = value.split("\n")
  const blocks: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""

    if (line.startsWith("```")) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []

      index += 1

      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        codeLines.push(lines[index] ?? "")
        index += 1
      }

      blocks.push(
        `<div class="overflow-hidden border border-border bg-muted" data-code-block="true" data-language="${escapeHtml(language)}">${
          language
            ? `<div class="border-b border-border px-3 py-1 text-xs text-muted-foreground">${escapeHtml(language)}</div>`
            : ""
        }<pre class="overflow-x-auto p-3 text-xs leading-relaxed"><code>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`
      )
      continue
    }

    if (!line.trim()) {
      continue
    }

    if (line.startsWith("# ")) {
      blocks.push(
        `<h1 class="text-3xl font-semibold">${renderInlineMarkdownHtml(line.slice(2))}</h1>`
      )
      continue
    }

    if (line.startsWith("## ")) {
      blocks.push(
        `<h2 class="text-2xl font-semibold">${renderInlineMarkdownHtml(line.slice(3))}</h2>`
      )
      continue
    }

    if (line.startsWith("### ")) {
      blocks.push(
        `<h3 class="text-xl font-semibold">${renderInlineMarkdownHtml(line.slice(4))}</h3>`
      )
      continue
    }

    if (line.startsWith("#### ")) {
      blocks.push(
        `<h4 class="text-lg font-semibold">${renderInlineMarkdownHtml(line.slice(5))}</h4>`
      )
      continue
    }

    if (line.startsWith("- ")) {
      const items: string[] = []

      while (index < lines.length && (lines[index] ?? "").startsWith("- ")) {
        items.push(
          `<li>${renderInlineMarkdownHtml((lines[index] ?? "").slice(2))}</li>`
        )
        index += 1
      }

      index -= 1
      blocks.push(
        `<ul class="list-disc space-y-1 pl-5">${items.join("")}</ul>`
      )
      continue
    }

    blocks.push(
      `<p class="text-sm/relaxed">${renderInlineMarkdownHtml(line)}</p>`
    )
  }

  return blocks.join("")
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.replaceAll("\u00a0", " ") ?? ""
  }

  if (!(node instanceof HTMLElement)) {
    return ""
  }

  if (node.matches("[data-code-block]")) {
    const language = node.dataset.language ?? ""
    const code = node.querySelector("code")?.textContent ?? ""

    return `\`\`\`${language}\n${code}\n\`\`\``
  }

  const children = Array.from(node.childNodes).map(nodeToMarkdown).join("")

  switch (node.tagName) {
    case "BR":
      return "\n"
    case "STRONG":
    case "B":
      return `**${children}**`
    case "EM":
    case "I":
      return `*${children}*`
    case "CODE":
      return node.textContent ? `\`${node.textContent}\`` : ""
    case "A":
      return `[${children}](${node.getAttribute("href") ?? ""})`
    case "H1":
      return `# ${children}`
    case "H2":
      return `## ${children}`
    case "H3":
      return `### ${children}`
    case "H4":
      return `#### ${children}`
    case "LI":
      return `- ${children}`
    case "UL":
      return Array.from(node.children).map(nodeToMarkdown).join("\n")
    case "P":
    case "DIV":
      return children
    default:
      return children
  }
}

function htmlToMarkdown(element: HTMLElement) {
  return Array.from(element.childNodes)
    .map(nodeToMarkdown)
    .filter((block) => block.trim())
    .join("\n\n")
}

function focusEnd(element: HTMLElement) {
  const range = document.createRange()
  const selection = window.getSelection()

  range.selectNodeContents(element)
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function getEditableRoot(node: Node | null) {
  const element =
    node instanceof HTMLElement
      ? node
      : node?.parentNode instanceof HTMLElement
        ? node.parentNode
        : null

  return element?.closest<HTMLElement>("[contenteditable='true']")
}

function selectInsertedText(node: Node) {
  const selection = window.getSelection()
  const range = document.createRange()
  const target =
    node instanceof HTMLElement
      ? node.querySelector("code,strong,em,h1,h2,h3,h4,li") ?? node
      : node

  range.selectNodeContents(target)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function insertPreviewMarkdown(
  root: HTMLElement,
  before: string,
  after = before,
  placeholder = "text"
) {
  const selection = window.getSelection()

  if (!selection?.rangeCount) {
    focusEnd(root)
  }

  const activeSelection = window.getSelection()
  const range = activeSelection?.rangeCount
    ? activeSelection.getRangeAt(0)
    : document.createRange()

  if (!getEditableRoot(range.commonAncestorContainer)) {
    focusEnd(root)
    return insertPreviewMarkdown(root, before, after, placeholder)
  }

  const selected = range.toString()
  const content = selected || placeholder
  const isBlockFormat = after === ""
  const html = isBlockFormat
    ? markdownToHtml(`${before}${content}`)
    : renderInlineMarkdownHtml(`${before}${content}${after}`)
  const nodes = htmlToNodes(html)
  const fragment = document.createDocumentFragment()
  const firstNode = nodes[0]

  for (const node of nodes) {
    fragment.append(node)
  }

  range.deleteContents()
  range.insertNode(fragment)

  if (!selected && firstNode) {
    selectInsertedText(firstNode)
  }
}

function getCurrentTopLevelBlock(root: HTMLElement, node: Node | null) {
  let currentNode = node

  while (currentNode && currentNode.parentNode !== root) {
    currentNode = currentNode.parentNode
  }

  return currentNode
}

function isMarkdownBlock(value: string) {
  return (
    /`[^`\n]+`/.test(value) ||
    /\*\*\*[^*\n]+\*\*\*/.test(value) ||
    /\*\*[^*\n]+\*\*/.test(value) ||
    /\*[^*\n]+\*/.test(value) ||
    /^#{1,4}\s+\S/.test(value) ||
    /^-\s+\S/.test(value) ||
    /^```[\s\S]*\n[\s\S]*\n```$/.test(value)
  )
}

function isCaretAtEndOfBlock(block: Node, range: Range) {
  const afterCaretRange = range.cloneRange()

  afterCaretRange.selectNodeContents(block)
  afterCaretRange.setStart(range.endContainer, range.endOffset)

  return afterCaretRange.toString().trim().length === 0
}

function htmlToNodes(html: string) {
  const template = document.createElement("template")

  template.innerHTML = html

  return Array.from(template.content.childNodes)
}

function renderCurrentBlockOnEnter(root: HTMLElement) {
  const selection = window.getSelection()

  if (!selection?.rangeCount) {
    return false
  }

  const range = selection.getRangeAt(0)

  if (!range.collapsed) {
    return false
  }

  const currentBlock = getCurrentTopLevelBlock(root, range.endContainer)

  if (!currentBlock || !isCaretAtEndOfBlock(currentBlock, range)) {
    return false
  }

  const markdown = nodeToMarkdown(currentBlock).trim()

  if (!isMarkdownBlock(markdown)) {
    return false
  }

  if (!currentBlock.parentNode) {
    return false
  }

  const nodes = htmlToNodes(markdownToHtml(markdown))
  const paragraph = document.createElement("p")
  const firstNode = nodes[0]

  paragraph.append(document.createElement("br"))

  if (!firstNode) {
    currentBlock.parentNode.replaceChild(paragraph, currentBlock)
    focusEnd(paragraph)
    return true
  }

  currentBlock.parentNode.insertBefore(firstNode, currentBlock)

  for (const node of nodes.slice(1)) {
    currentBlock.parentNode.insertBefore(node, currentBlock)
  }

  currentBlock.parentNode.insertBefore(paragraph, currentBlock)
  currentBlock.parentNode.removeChild(currentBlock)
  focusEnd(paragraph)

  return true
}

function EditableMarkdownPreview({
  previewRef,
  value,
  onChange,
  placeholder,
}: {
  previewRef: React.RefObject<HTMLDivElement | null>
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  React.useEffect(() => {
    const preview = previewRef.current

    if (!preview || document.activeElement === preview) {
      return
    }

    preview.innerHTML = markdownToHtml(value)
  }, [previewRef, value])

  return (
    <div
      ref={previewRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className="min-h-48 space-y-3 overflow-y-auto whitespace-pre-wrap wrap-break-word p-3 outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:ring-1 focus-visible:ring-ring/50"
      onInput={(event) => onChange(htmlToMarkdown(event.currentTarget))}
      onKeyDown={(event) => {
        if (event.key !== "Enter") {
          return
        }

        if (!renderCurrentBlockOnEnter(event.currentTarget)) {
          return
        }

        event.preventDefault()

        const preview = event.currentTarget
        onChange(htmlToMarkdown(preview))
      }}
    />
  )
}

function MarkdownEditor({
  className,
  defaultPreview = false,
  defaultValue,
  maxLength,
  name,
  placeholder,
  rows = 6,
  ...props
}: MarkdownEditorProps) {
  const [value, setValue] = React.useState(defaultValue ?? "")
  const [preview, setPreview] = React.useState(defaultPreview)
  const previewRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  function format(before: string, after?: string) {
    if (preview) {
      const previewElement = previewRef.current

      if (!previewElement) {
        return
      }

      insertPreviewMarkdown(previewElement, before, after)
      setValue(htmlToMarkdown(previewElement))
      return
    }

    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    insertMarkdown(textarea, value, setValue, before, after)
  }
  return (
    <div className={cn("overflow-hidden border border-input bg-background", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 p-2">
        <div
          className="flex flex-wrap items-center gap-1"
          onMouseDown={(event) => event.preventDefault()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Heading 1"
            onClick={() => format("# ", "")}
          >
            <Heading1 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Heading 2"
            onClick={() => format("## ", "")}
          >
            <Heading2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Heading 3"
            onClick={() => format("### ", "")}
          >
            <Heading3 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Heading 4"
            onClick={() => format("#### ", "")}
          >
            <Heading4 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bold"
            onClick={() => format("**")}
          >
            <Bold />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Italic"
            onClick={() => format("*")}
          >
            <Italic />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Code"
            onClick={() => format("`")}
          >
            <Code />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="List"
            onClick={() => format("- ", "")}
          >
            <List />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={preview ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setPreview(false)}
          >
            <Pencil />
            Write
          </Button>
          <Button
            type="button"
            variant={preview ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreview(true)}
          >
            <Eye />
            Preview
          </Button>
        </div>
      </div>

      {preview ? (
        <EditableMarkdownPreview
          previewRef={previewRef}
          value={value}
          placeholder={placeholder}
          onChange={setValue}
        />
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={rows}
          className="min-h-48 resize-y overflow-y-auto border-0 shadow-none focus-visible:ring-0"
          onChange={(event) => setValue(event.target.value)}
          {...props}
        />
      )}
    </div>
  )
}

export { MarkdownEditor }
