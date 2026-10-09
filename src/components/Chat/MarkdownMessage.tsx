import { Component, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './MarkdownMessage.css'

// A resposta da IA é dado não confiável (§7.2). Só estes protocolos podem virar
// destino de link ou origem de imagem; qualquer outro — javascript:, data:,
// vbscript:, file:, blob: — é descartado.
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:']

/**
 * Devolve a URL se o protocolo for seguro, ou string vazia para neutralizá-la.
 * A base fictícia serve só para o parser aceitar URLs relativas; relativas
 * resolvem para https e passam.
 *
 * Usa o parser de URL do próprio navegador em vez de comparar strings: ele já
 * normaliza os disfarces clássicos (`java\tscript:`, `JavaScript:`, espaços e
 * caracteres de controle no meio do esquema) antes de expor o protocolo.
 */
function safeUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://chatinova.invalid/')
    return SAFE_PROTOCOLS.includes(parsed.protocol) ? url : ''
  } catch {
    return ''
  }
}

interface MarkdownMessageProps {
  content: string
}

/**
 * Corrige quando o modelo insere quebras de linha logo após o número da lista
 * (ex: "1.\n\n**Título**" vira "1. **Título**").
 *
 * Só casa linhas que contêm apenas o marcador (até 3 dígitos), para não juntar
 * um ano como "2024." com a linha seguinte. Usa [ \t] em vez de \s para que o
 * padrão não atravesse linhas antes do marcador.
 */
function normalizeMarkdown(text: string): string {
  return text.replace(/^([ \t]*\d{1,3}\.)[ \t]*\n+[ \t]*(?=\S)/gm, '$1 ')
}

interface MarkdownErrorBoundaryProps {
  content: string
  children: ReactNode
}

interface MarkdownErrorBoundaryState {
  hasError: boolean
  content: string
}

/**
 * Se a renderização do markdown lançar erro, mostra a resposta como texto puro
 * em vez de derrubar a aplicação inteira. Quando o conteúdo muda (ex: durante
 * o streaming), o erro é descartado e o markdown é tentado de novo.
 */
class MarkdownErrorBoundary extends Component<MarkdownErrorBoundaryProps, MarkdownErrorBoundaryState> {
  state: MarkdownErrorBoundaryState = { hasError: false, content: this.props.content }

  static getDerivedStateFromError(): Partial<MarkdownErrorBoundaryState> {
    return { hasError: true }
  }

  static getDerivedStateFromProps(
    props: MarkdownErrorBoundaryProps,
    state: MarkdownErrorBoundaryState,
  ): Partial<MarkdownErrorBoundaryState> | null {
    return props.content !== state.content ? { hasError: false, content: props.content } : null
  }

  componentDidCatch(error: unknown) {
    console.error('Falha ao renderizar markdown da resposta:', error)
  }

  render() {
    if (this.state.hasError) {
      return <p className="markdown-message__fallback">{this.props.content}</p>
    }
    return this.props.children
  }
}

function MarkdownMessage({ content }: MarkdownMessageProps) {
  const normalizedContent = normalizeMarkdown(content)

  return (
    <div className="markdown-message">
      <MarkdownErrorBoundary content={content}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={safeUrl}
          components={{
            // Sem href utilizável o link vira texto comum: nada de âncora morta
            // que ainda pareça clicável.
            // `node` é o nó da AST do react-markdown, não um atributo HTML: sem
            // descartá-lo aqui, o spread o despeja no DOM como node="[object Object]".
            a: ({ children, href, node: _node, ...props }) =>
              href ? (
                <a {...props} href={href} target="_blank" rel="noopener noreferrer nofollow">
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              ),
            img: ({ src, alt, node: _node, ...props }) =>
              src ? <img {...props} src={src} alt={alt ?? ''} loading="lazy" /> : null,
          }}
        >
          {normalizedContent}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  )
}

export default MarkdownMessage
