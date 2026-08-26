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

function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-message">
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
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownMessage
