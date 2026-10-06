import { useState, useEffect } from "react";
import { Icon } from "./icons.jsx";
import { Link } from "react-router-dom";

// ─── Modal de Vídeo (Para quando tiver links de vídeos) ──────────────────────
function VideoModal({ videoUrl, title, onClose }) {
  if (!videoUrl) return null;

  // Suporte a YouTube embed ou link direto de vídeo
  const getEmbedUrl = (url) => {
    if (url.includes("youtube.com/watch?v=")) {
      return url.replace("watch?v=", "embed/");
    }
    if (url.includes("youtu.be/")) {
      return url.replace("youtu.be/", "www.youtube.com/embed/");
    }
    return url;
  };

  const embedUrl = getEmbedUrl(videoUrl);
  const isEmbeddable = embedUrl.includes("youtube.com/embed") || embedUrl.includes("vimeo.com");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 15, 23, 0.9)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface, #111726)",
        border: "1px solid var(--border, rgba(255,255,255,0.15))",
        borderRadius: "16px",
        width: "100%",
        maxWidth: 800,
        overflow: "hidden",
        boxShadow: "0 25px 50px rgba(0,0,0,0.7)"
      }}>
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
            <Icon name="play" size={16} color="var(--accent, #f97316)" />
            <span>{title || "Vídeo Tutorial"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "8px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "#000" }}>
          {isEmbeddable ? (
            <iframe
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <video
              src={embedUrl}
              controls
              autoPlay
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dados dos Tutoriais e Artigos da Wiki (Apenas Escrito + Pronto para Vídeo) ───
const TUTORIAIS = [
  {
    id: "criar-produto",
    videoUrl: "", // Adicione o link do vídeo aqui futuramente
    category: "produtos",
    title: "Como Cadastrar um Novo Produto",
    summary: "Guia completo de cadastro no catálogo: preenchimento de nome, categoria, quantidade inicial, unidade e limites de reposição.",
    icon: "plus",
    badge: "Essencial",
    badgeColor: "#10b981",
    steps: [
      {
        num: 1,
        title: "Acessar a aba de Estoque",
        text: "No menu superior do sistema, clique na aba 'Estoque'. Você verá a lista completa de produtos cadastrados no setor selecionado atualmente.",
        tip: "Verifique na barra superior se o setor correto está ativo antes de cadastrar o item."
      },
      {
        num: 2,
        title: "Abrir o formulário de cadastro",
        text: "No canto superior direito da tabela de estoque, clique no botão destacado '+ NOVO PRODUTO'. A janela de cadastro será aberta no centro da tela.",
        tip: "Você também pode utilizar o atalho de bipe caso possua leitor de código de barras físico."
      },
      {
        num: 3,
        title: "Preencher as informações obrigatórias",
        text: "Preencha o Nome do Produto (ex: 'Papel Sulfite A4 75g Chamex'), selecione ou crie uma Categoria (ex: 'Papelaria'), defina a Quantidade Inicial que já existe fisicamente no setor e a Unidade de medida (un, cx, pct, kg).",
        tip: "Defina nomes padronizados e claros para facilitar a busca dos operadores."
      },
      {
        num: 4,
        title: "Configurar o Estoque Mínimo (Alerta de Reposição)",
        text: "No campo 'Estoque Mínimo', digite a quantidade limite de segurança. Quando o estoque atingir ou ficar abaixo desse número, o sistema exibirá automaticamente um aviso amarelo ou vermelho alertando a necessidade de reposição.",
        tip: "Exemplo: se você consome 10 unidades por semana e o fornecedor demora 3 dias, defina o mínimo como 5 unidades."
      },
      {
        num: 5,
        title: "Salvar e Conferir na Lista",
        text: "Clique no botão 'Salvar Produto'. Uma notificação de sucesso aparecerá no topo da tela e o produto já estará disponível para requisição de operadores e movimentações.",
        tip: "O produto já entra imediatamente no relatório de inventário e logs."
      }
    ]
  },
  {
    id: "dar-entrada",
    videoUrl: "",
    category: "movimentacao",
    title: "Como Dar Entrada no Estoque (Reposição e Compras)",
    summary: "Como registrar a chegada de mercadorias, lotes de fornecedores ou devoluções de material ao setor.",
    icon: "arrowUp",
    badge: "Operação",
    badgeColor: "#3b82f6",
    steps: [
      {
        num: 1,
        title: "Localizar o produto no estoque",
        text: "Na aba 'Estoque', utilize o campo de busca no topo para digitar o nome, código ou categoria do produto que recebeu reposição.",
        tip: "Você também pode bipar o código de barras diretamente para abrir a ação do produto."
      },
      {
        num: 2,
        title: "Clicar no botão verde de Entrada (+)",
        text: "Na linha do produto desejado, localize e clique no botão de Entrada (identificado pelo sinal '+' ou seta para cima verde).",
        tip: "A tela abrirá um modal solicitando a quantidade e a justificativa."
      },
      {
        num: 3,
        title: "Digitar a quantidade recebida e a observação",
        text: "Informe o número exato de unidades que entraram no estoque físico. No campo 'Observação', registre a origem (ex: 'Compra Kalunga - NF 9821' ou 'Devolução de Material').",
        tip: "Informar o número da Nota Fiscal facilita a prestação de contas e auditorias futuras."
      },
      {
        num: 4,
        title: "Confirmar a movimentação",
        text: "Clique no botão 'Confirmar Entrada'. O saldo em estoque é somado instantaneamente e um registro completo é gravado na aba 'Histórico/Logs' com data, hora e responsável.",
        tip: "Caso o produto estivesse com status 'Baixo' ou 'Zerado', o status é recalculado para 'OK' na hora."
      }
    ]
  },
  {
    id: "dar-saida",
    videoUrl: "",
    category: "movimentacao",
    title: "Como Dar Saída no Estoque (Baixas, Consumo e Descarte)",
    summary: "Como registrar a saída de materiais utilizados, consumidos por departamentos ou baixas por avaria.",
    icon: "arrowDown",
    badge: "Operação",
    badgeColor: "#f59e0b",
    steps: [
      {
        num: 1,
        title: "Localizar o item a ser retirado",
        text: "Encontre o produto na tabela de estoque através da barra de pesquisa ou navegando pelas categorias do setor.",
        tip: "Sempre confira o saldo disponível em estoque antes de autorizar a retirada física."
      },
      {
        num: 2,
        title: "Clicar no botão vermelho de Saída (−)",
        text: "Na linha do produto, clique no botão de Saída (identificado pelo sinal '−' ou seta vermelha para baixo).",
        tip: "O sistema não permite registrar saídas maiores do que a quantidade física existente."
      },
      {
        num: 3,
        title: "Informar quantidade a retirar e motivo do consumo",
        text: "Digite a quantidade que está saindo do almoxarifado. No campo de justificativa, descreva quem retirou e para qual finalidade (ex: 'Uso no Setor de Limpeza - Solicitado por Maria', 'Avaria no transporte').",
        tip: "Justificativas claras eliminam discrepâncias no inventário de fechamento de mês."
      },
      {
        num: 4,
        title: "Confirmar a saída",
        text: "Clique em 'Confirmar Saída'. O sistema subtrai as unidades na hora. Se o estoque atingir a quantidade mínima, o item muda de cor e um alerta é emitido.",
        tip: "O log registrará exatamente quem deu a baixa e a quantidade retirada."
      }
    ]
  },
  {
    id: "editar-deletar",
    videoUrl: "",
    category: "produtos",
    title: "Como Editar ou Deletar Produtos",
    summary: "Como atualizar nomes, categorias, unidade e limites de produtos, ou excluir produtos fora de linha.",
    icon: "edit",
    badge: "Gestão",
    badgeColor: "#8b5cf6",
    steps: [
      {
        num: 1,
        title: "Editar Dados de um Produto",
        text: "Na linha do produto que deseja alterar, clique no ícone de Lápis (Editar). O modal com as informações atuais do produto será exibido.",
        tip: "Você pode alterar o nome, categoria, unidade de medida ou os níveis de estoque mínimo."
      },
      {
        num: 2,
        title: "Salvar as Alterações",
        text: "Faça os ajustes necessários e clique em 'Salvar Alterações'. As modificações são sincronizadas imediatamente em todos os computadores e celulares conectados.",
        tip: "Alterar o nome do produto não apaga o histórico de movimentações anteriores dele."
      },
      {
        num: 3,
        title: "Como Deletar um Produto",
        text: "Se um produto não é mais utilizado ou foi cadastrado por engano, clique no ícone de Lixeira (Excluir) na linha correspondente.",
        tip: "Certifique-se de que o estoque físico está zerado antes de excluir o produto."
      },
      {
        num: 4,
        title: "Confirmar a Exclusão Segura",
        text: "Uma mensagem de confirmação com o nome do produto aparecerá na tela. Clique em 'OK' / 'Confirmar' para concluir a exclusão definitiva.",
        tip: "Apenas administradores têm permissão para deletar produtos do banco de dados."
      }
    ]
  },
  {
    id: "criar-operador",
    videoUrl: "",
    category: "operadores",
    title: "Como Criar Operador / Solicitante (Login Próprio)",
    summary: "Cadastre funcionários de cada setor com ID único de 3 letras + 3 números e senha para requisição direta.",
    icon: "user",
    badge: "Requisições",
    badgeColor: "#f97316",
    steps: [
      {
        num: 1,
        title: "Acessar as Configurações do Sistema",
        text: "No menu superior, clique na aba 'Configurações' e role a tela até a seção 'Setores Cadastrados'.",
        tip: "Cada setor tem sua própria lista de operadores e solicitantes autorizados."
      },
      {
        num: 2,
        title: "Clicar em 'Operadores / Solicitantes'",
        text: "No cartão do setor desejado, localize o botão destacado com borda 'Operadores / Solicitantes' e clique nele para abrir o painel de operadores.",
        tip: "O modal central se abrirá com o formulário 'NOVO OPERADOR / SOLICITANTE' no topo."
      },
      {
        num: 3,
        title: "Preencher o Nome do Colaborador",
        text: "No campo 'Nome do Operador', digite o nome completo ou cargo (ex: 'Carlos Almoxarifado', 'Maria Recepção').",
        tip: "Esse nome aparecerá em todas as requisições que ele fizer, facilitando identificar quem pediu."
      },
      {
        num: 4,
        title: "Conferir o ID Único e Definir a Senha",
        text: "O sistema gera automaticamente um ID Único de 3 letras + 3 números (ex: GHS795). Você pode clicar no botão de recarregar para gerar outro se quiser. Em seguida, defina a Senha de Acesso (padrão 1234 ou personalizada).",
        tip: "O ID Único garante que dois operadores nunca tenham logins iguais no sistema."
      },
      {
        num: 5,
        title: "Clicar em '+ CRIAR OPERADOR COM ID'",
        text: "Clique no botão marrom destacado para salvar. O operador aparecerá na lista abaixo com os badges de ID e Senha prontos para uso.",
        tip: "Você também pode filtrar quais categorias esse operador tem permissão para pedir clicando no ícone de filtro."
      }
    ]
  },
  {
    id: "enviar-link",
    videoUrl: "",
    category: "operadores",
    title: "Como Enviar o Link e Acesso para o Operador",
    summary: "Envie as credenciais e o link de requisição diretamente para o WhatsApp do funcionário com 1 clique.",
    icon: "share",
    badge: "Compartilhar",
    badgeColor: "#10b981",
    steps: [
      {
        num: 1,
        title: "Abrir a lista de Operadores do Setor",
        text: "Em Configurações > Setores, clique no botão 'Operadores / Solicitantes'. Localize o operador que deseja notificar na lista.",
        tip: "Todos os operadores cadastrados ficam listados com seus respectivos IDs e senhas."
      },
      {
        num: 2,
        title: "Clicar no botão 'Copiar Acesso'",
        text: "Ao lado dos dados do operador, clique no botão 'Copiar Acesso'. O sistema copia instantaneamente para a sua área de transferência uma mensagem pronta e formatada.",
        tip: "Um aviso verde confirmará que o texto de acesso foi copiado com sucesso."
      },
      {
        num: 3,
        title: "Colar e Enviar no WhatsApp",
        text: "Abra a conversa do colaborador no WhatsApp (no computador ou celular) e cole a mensagem (Ctrl + V ou Segurar e Colar). Envie.",
        tip: "A mensagem enviada contém: Link direto (/requisicao), Nome, ID de Acesso, Senha e Nome do Setor."
      },
      {
        num: 4,
        title: "Acesso Imediato do Colaborador",
        text: "O funcionário só precisa clicar no link recebido, digitar o ID e a Senha. Ele entra direto no catálogo do setor sem precisar criar conta de e-mail ou passar por aprovações manuais.",
        tip: "O colaborador pode favoritar o link no celular para pedir sempre que precisar."
      }
    ]
  },
  {
    id: "fazer-requisicao",
    videoUrl: "",
    category: "requisicao",
    title: "Como o Operador Faz a Requisição (Pelo Celular ou PC)",
    summary: "Passo a passo completo do solicitante: login com ID, seleção de produtos, quantidade, prioridade e acompanhamento.",
    icon: "clipboardList",
    badge: "Solicitante",
    badgeColor: "#06b6d4",
    steps: [
      {
        num: 1,
        title: "Acessar a página de Requisição",
        text: "Abra o navegador e acesse o endereço `/requisicao` enviado pelo gestor da sua empresa.",
        tip: "Você pode usar qualquer smartphone, tablet ou computador conectado à internet."
      },
      {
        num: 2,
        title: "Fazer login com ID Único e Senha",
        text: "Digite o seu ID de 6 caracteres (ex: GHS795) e a sua Senha informada pelo gestor. Clique em 'Entrar'.",
        tip: "O sistema reconhece seu setor automaticamente e abre apenas os itens que você pode solicitar."
      },
      {
        num: 3,
        title: "Escolher os produtos e definir quantidades",
        text: "Busque pelo nome ou clique nas categorias do catálogo. Clique no produto desejado, selecione a quantidade (+ / −) e clique em 'ADICIONAR'.",
        tip: "Você pode adicionar quantos produtos diferentes quiser em um único pedido."
      },
      {
        num: 4,
        title: "Definir o Nível de Prioridade e Observação",
        text: "Selecione o nível de urgência do pedido: Baixa (azul), Média (amarelo) ou Alta (vermelho). Adicione observações caso necessário (ex: 'Para o evento de amanhã').",
        tip: "Pedidos com prioridade Alta ganham destaque imediato na tela do almoxarifado."
      },
      {
        num: 5,
        title: "Enviar e Guardar o Código de Acompanhamento",
        text: "Clique em 'ENVIAR REQUISIÇÃO'. Uma tela de confirmação verde será exibida com o código de rastreio (ex: REQ-X82A1). Pronto! O pedido já chegou para a equipe de estoque.",
        tip: "Na aba 'Minhas Requisições' você pode ver se o pedido está Pendente, Aprovado ou Pronto para Retirada."
      }
    ]
  },
  {
    id: "aprovar-requisicao",
    videoUrl: "",
    category: "requisicao",
    title: "Como o Administrador Aprova e Despacha Requisições",
    summary: "Como o almoxarife gerencia pedidos pendentes, analisa tempos de espera e entrega com baixa automática no estoque.",
    icon: "checkCircle",
    badge: "Almoxarifado",
    badgeColor: "#10b981",
    steps: [
      {
        num: 1,
        title: "Acessar a aba 'Requisições' no Painel Principal",
        text: "No menu superior do sistema, clique em 'Requisições'. Você verá a lista de todos os pedidos separados por abas: Pendentes, Aprovadas, Recusadas e Entregues.",
        tip: "O número no topo indica quantas requisições aguardam sua resposta."
      },
      {
        num: 2,
        title: "Visualizar os Detalhes da Requisição",
        text: "Clique em cima do pedido para expandir os detalhes. Você verá quem solicitou, os itens pedidos, observação, nível de prioridade e há quanto tempo o pedido está na fila.",
        tip: "O sistema calcula o tempo em minutos/horas que o operador está esperando."
      },
      {
        num: 3,
        title: "Aprovar, Recusar ou Finalizar Entrega",
        text: "Clique em 'Aprovar' para confirmar que os itens serão separados. Quando o operador retirar os produtos, clique em 'Entregar'. O sistema pode dar baixa automática nos saldos do estoque!",
        tip: "Se recusar um pedido, você pode adicionar a justificativa para o solicitante saber o motivo."
      }
    ]
  },
  {
    id: "criar-setores",
    videoUrl: "",
    category: "configuracoes",
    title: "Como Criar e Organizar Setores da Empresa",
    summary: "Como dividir o estoque por departamentos independentes: Almoxarifado, TI, Cozinha, Manutenção, Limpeza, etc.",
    icon: "building",
    badge: "Configuração",
    badgeColor: "#6366f1",
    steps: [
      {
        num: 1,
        title: "Acessar Configurações > Setores Cadastrados",
        text: "No menu superior, vá em 'Configurações' e localize a seção 'Setores Cadastrados'. Clique no botão '+ NOVO SETOR'.",
        tip: "Setores garantem que os dados de cada departamento fiquem organizados e separados."
      },
      {
        num: 2,
        title: "Escolher Identificador, Nome, Cor e Ícone",
        text: "Defina o Identificador em letras minúsculas (ex: cozinha, ti), o Nome exibido (ex: 'Cozinha Central'), selecione a Cor visual dos botões e o Ícone representativo.",
        tip: "Cores e ícones facilitam a troca rápida de setor no cabeçalho do sistema."
      },
      {
        num: 3,
        title: "Definir o PIN Master e Salvar",
        text: "Informe um PIN numérico de 4 dígitos para segurança do setor e clique em 'CRIAR SETOR'. O setor é ativado na hora para cadastro de produtos e operadores.",
        tip: "Você pode editar ou alterar o PIN do setor a qualquer momento clicando no ícone de lápis."
      }
    ]
  }
];

// ─── Categorias de Filtro da Wiki ───────────────────────────────────────────
const CATEGORIAS = [
  { id: "todos", label: "Todos os Artigos", icon: "clipboardList" },
  { id: "produtos", label: "Produtos & Cadastro", icon: "package" },
  { id: "movimentacao", label: "Entradas & Saídas", icon: "refreshCw" },
  { id: "operadores", label: "Operadores & Acessos", icon: "user" },
  { id: "requisicao", label: "Requisições de Estoque", icon: "checkCircle" },
  { id: "configuracoes", label: "Configuração & Setores", icon: "settings" }
];

export default function Wiki() {
  const [busca, setBusca] = useState("");
  const [catSel, setCatSel] = useState("todos");
  const [expandedId, setExpandedId] = useState("criar-produto");
  const [activeVideo, setActiveVideo] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    document.title = "System Stock Wiki — Base de Conhecimento e Manuais";
  }, []);

  // Filtragem dos tutoriais
  const filtrados = TUTORIAIS.filter(tut => {
    const matchCat = catSel === "todos" || tut.category === catSel;
    const matchBusca = !busca.trim() ||
      tut.title.toLowerCase().includes(busca.toLowerCase()) ||
      tut.summary.toLowerCase().includes(busca.toLowerCase()) ||
      tut.steps.some(s => s.title.toLowerCase().includes(busca.toLowerCase()) || s.text.toLowerCase().includes(busca.toLowerCase()));
    return matchCat && matchBusca;
  });

  const handleCopyWikiLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b0f17",
      color: "#f0f6fc",
      fontFamily: "var(--sans, system-ui, -apple-system, sans-serif)",
      paddingBottom: 60
    }}>
      {/* ─── Top Header Bar ────────────────────────────────────────── */}
      <header style={{
        background: "rgba(16, 22, 34, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "14px 20px"
      }}>
        <div style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12
        }}>
          {/* Logo e Nome da Wiki */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
              color: "#fff"
            }}>
              <Icon name="package" size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--display, sans-serif)", fontSize: 18, fontWeight: 800, letterSpacing: "1px", color: "#f0f6fc" }}>
                  SYSTEM STOCK
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: "var(--mono, monospace)",
                  background: "rgba(249,115,22,0.15)",
                  color: "var(--accent, #f97316)",
                  border: "1px solid rgba(249,115,22,0.35)",
                  padding: "2px 7px",
                  borderRadius: "12px",
                  fontWeight: 700
                }}>
                  WIKI OFICIAL
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#8b949e" }}>
                Base de Conhecimento, Manuais e Guias Passo a Passo
              </div>
            </div>
          </div>

          {/* Links e Botões de Ação */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleCopyWikiLink}
              style={{
                background: "#161b22",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#f0f6fc",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              title="Copiar Link da Wiki para enviar à equipe"
            >
              <Icon name={copiedLink ? "check" : "copy"} size={14} color={copiedLink ? "#10b981" : "currentColor"} />
              {copiedLink ? "Link Copiado!" : "Compartilhar Wiki"}
            </button>

            <Link
              to="/"
              style={{
                background: "var(--accent, #f97316)",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 10px rgba(249,115,22,0.25)"
              }}
            >
              <Icon name="login" size={14} /> Entrar no Sistema
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ──────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "36px 20px 24px 20px",
        textAlign: "center"
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(249,115,22,0.1)",
          border: "1px solid rgba(249,115,22,0.25)",
          color: "#f97316",
          padding: "5px 12px",
          borderRadius: "20px",
          fontSize: 11,
          fontFamily: "var(--mono, monospace)",
          fontWeight: 700,
          marginBottom: 16
        }}>
          <Icon name="sparkles" size={13} /> WIKI & DOCUMENTAÇÃO OFICIAL
        </div>

        <h1 style={{
          fontFamily: "var(--sans, sans-serif)",
          fontSize: "clamp(24px, 4vw, 38px)",
          fontWeight: 800,
          letterSpacing: "-0.5px",
          color: "#ffffff",
          margin: "0 0 12px 0",
          lineHeight: 1.2
        }}>
          Wiki do <span style={{ color: "#f97316" }}>System Stock</span>: Guia Completo do Sistema
        </h1>

        <p style={{
          fontSize: "clamp(13px, 2vw, 15px)",
          color: "#8b949e",
          maxWidth: 680,
          margin: "0 auto 28px auto",
          lineHeight: 1.6
        }}>
          Documentação estruturada com o passo a passo de todas as funções do sistema: cadastro de produtos, controle de estoque (entradas e saídas), gestão de operadores com ID único, compartilhamento de link para solicitação e muito mais.
        </p>

        {/* Barra de Busca Dinâmica */}
        <div style={{
          maxWidth: 580,
          margin: "0 auto 24px auto",
          position: "relative"
        }}>
          <input
            type="text"
            placeholder="Pesquisar na Wiki... (ex: cadastrar produto, saída, operador, link, setor...)"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: "100%",
              background: "#111726",
              border: "1.5px solid rgba(255,255,255,0.18)",
              borderRadius: "12px",
              padding: "14px 44px 14px 44px",
              color: "#f0f6fc",
              fontSize: 14,
              fontFamily: "var(--sans, sans-serif)",
              boxSizing: "border-box",
              outline: "none",
              boxShadow: "0 6px 25px rgba(0,0,0,0.3)"
            }}
          />
          <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim, #8b949e)", pointerEvents: "none" }}>
            <Icon name="search" size={18} />
          </div>
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text-dim, #8b949e)",
                cursor: "pointer",
                padding: 4
              }}
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>

        {/* Pílulas de Categorias */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 8
        }}>
          {CATEGORIAS.map(cat => {
            const active = catSel === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCatSel(cat.id)}
                style={{
                  background: active ? "#f97316" : "#111726",
                  color: active ? "#ffffff" : "#8b949e",
                  border: active ? "1.5px solid #f97316" : "1px solid rgba(255,255,255,0.1)",
                  padding: "7px 14px",
                  borderRadius: "20px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s"
                }}
              >
                <Icon name={cat.icon || "package"} size={13} color={active ? "#fff" : "currentColor"} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Lista de Artigos da Wiki ─────────────────────────────────── */}
      <main style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "0 20px"
      }}>
        {filtrados.length === 0 ? (
          <div style={{
            background: "#111726",
            border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: "16px",
            padding: "50px 20px",
            textAlign: "center",
            marginTop: 20
          }}>
            <Icon name="search" size={36} color="#8b949e" />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>Nenhum artigo encontrado</h3>
            <p style={{ fontSize: 13, color: "#8b949e", maxWidth: 380, margin: "0 auto" }}>
              Não encontramos artigos com o termo "{busca}". Tente pesquisar por palavras como "produto", "saída", "entrada", "setor" ou "operador".
            </p>
            <button
              type="button"
              onClick={() => { setBusca(""); setCatSel("todos"); }}
              style={{
                marginTop: 16,
                background: "#161b22",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#f97316",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Limpar Filtros de Busca
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {filtrados.map((tut, idx) => {
              const isExpanded = expandedId === tut.id;
              const hasVideo = Boolean(tut.videoUrl && tut.videoUrl.trim());

              return (
                <div
                  key={tut.id}
                  style={{
                    background: "#111726",
                    border: isExpanded ? "1.5px solid #f97316" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    overflow: "hidden",
                    transition: "all 0.25s ease",
                    boxShadow: isExpanded ? "0 8px 30px rgba(0,0,0,0.4)" : "0 2px 10px rgba(0,0,0,0.15)"
                  }}
                >
                  {/* Cabeçalho do Card (Clicável para Expandir/Recolher) */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : tut.id)}
                    style={{
                      padding: "20px 24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      background: isExpanded ? "rgba(249,115,22,0.04)" : "transparent",
                      borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.08)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        background: `${tut.badgeColor || "var(--accent)"}18`,
                        border: `1px solid ${tut.badgeColor || "var(--accent)"}33`,
                        color: tut.badgeColor || "#f97316",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2
                      }}>
                        <Icon name={tut.icon || "package"} size={22} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10,
                            fontFamily: "var(--mono, monospace)",
                            fontWeight: 700,
                            color: tut.badgeColor || "var(--accent)",
                            background: `${tut.badgeColor || "var(--accent)"}14`,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            border: `1px solid ${tut.badgeColor || "var(--accent)"}33`
                          }}>
                            SEÇÃO {idx + 1} • {tut.badge.toUpperCase()}
                          </span>

                          <span style={{ fontSize: 11, color: "#8b949e", fontFamily: "var(--mono, monospace)" }}>
                            {tut.steps.length} Passos
                          </span>

                          {/* Badge de Vídeo */}
                          {hasVideo ? (
                            <span style={{
                              fontSize: 10,
                              fontFamily: "var(--sans, sans-serif)",
                              fontWeight: 700,
                              color: "#10b981",
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}>
                              <Icon name="play" size={10} /> Vídeo Disponível
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 10,
                              fontFamily: "var(--sans, sans-serif)",
                              color: "#8b949e",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              padding: "2px 8px",
                              borderRadius: "10px"
                            }}>
                              🎬 Vídeo em breve
                            </span>
                          )}
                        </div>

                        <h2 style={{
                          fontFamily: "var(--sans, sans-serif)",
                          fontSize: "clamp(16px, 2.5vw, 19px)",
                          fontWeight: 700,
                          color: "#ffffff",
                          margin: 0,
                          lineHeight: 1.3
                        }}>
                          {tut.title}
                        </h2>

                        <p style={{
                          fontSize: 12,
                          color: "#8b949e",
                          margin: "6px 0 0 0",
                          lineHeight: 1.5
                        }}>
                          {tut.summary}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 16 }}>
                      {hasVideo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveVideo({ url: tut.videoUrl, title: tut.title });
                          }}
                          style={{
                            background: "rgba(249,115,22,0.15)",
                            border: "1px solid #f97316",
                            color: "#f97316",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            cursor: "pointer"
                          }}
                        >
                          <Icon name="play" size={12} /> Ver Vídeo
                        </button>
                      )}

                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        background: "#161b22",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#8b949e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease"
                      }}>
                        <Icon name="chevronDown" size={16} />
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo Expandido com os Passos Escritos Detalhados */}
                  {isExpanded && (
                    <div style={{ padding: "24px", background: "#111726" }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                        marginBottom: 20,
                        paddingBottom: 12,
                        borderBottom: "1px solid rgba(255,255,255,0.06)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon name="clipboardList" size={16} color="var(--accent, #f97316)" />
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono, monospace)", color: "#ffffff", letterSpacing: "0.5px" }}>
                            ROTEIRO PASSO A PASSO
                          </span>
                        </div>

                        {hasVideo ? (
                          <button
                            type="button"
                            onClick={() => setActiveVideo({ url: tut.videoUrl, title: tut.title })}
                            style={{
                              background: "#f97316",
                              color: "#fff",
                              border: "none",
                              padding: "6px 14px",
                              borderRadius: "8px",
                              fontSize: 12,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer"
                            }}
                          >
                            <Icon name="play" size={13} color="#fff" /> Assistir Aula em Vídeo
                          </button>
                        ) : (
                          <div style={{
                            fontSize: 11,
                            color: "#8b949e",
                            fontFamily: "var(--mono, monospace)",
                            background: "rgba(255,255,255,0.03)",
                            padding: "4px 10px",
                            borderRadius: "6px"
                          }}>
                            Guia Escrito Completo
                          </div>
                        )}
                      </div>

                      {/* Grade dos Passos */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {tut.steps.map((st) => (
                          <div
                            key={st.num}
                            style={{
                              background: "#161b22",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: "12px",
                              padding: "16px 18px",
                              display: "flex",
                              gap: 16,
                              alignItems: "flex-start"
                            }}
                          >
                            {/* Número do Passo */}
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                              color: "#fff",
                              fontFamily: "var(--mono, monospace)",
                              fontWeight: 800,
                              fontSize: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: 2,
                              boxShadow: "0 2px 8px rgba(249,115,22,0.35)"
                            }}>
                              {st.num}
                            </div>

                            {/* Conteúdo Explicativo */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h3 style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#f0f6fc",
                                margin: "0 0 6px 0",
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                              }}>
                                {st.title}
                              </h3>

                              <p style={{
                                fontSize: 13,
                                color: "#c9d1d9",
                                margin: "0 0 8px 0",
                                lineHeight: 1.6
                              }}>
                                {st.text}
                              </p>

                              {st.tip && (
                                <div style={{
                                  background: "rgba(249,115,22,0.08)",
                                  borderLeft: "3px solid var(--accent, #f97316)",
                                  padding: "8px 12px",
                                  borderRadius: "0 8px 8px 0",
                                  fontSize: 12,
                                  color: "#f97316",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6
                                }}>
                                  <Icon name="sparkles" size={13} />
                                  <span><strong>Dica Prática:</strong> {st.tip}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Vídeo */}
      {activeVideo && (
        <VideoModal
          videoUrl={activeVideo.url}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      )}

      {/* ─── Footer Informativo ────────────────────────────────────── */}
      <footer style={{
        maxWidth: 1180,
        margin: "60px auto 0 auto",
        padding: "24px 20px 0 20px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        fontSize: 12,
        color: "#8b949e"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="package" size={16} color="var(--accent, #f97316)" />
          <span>System Stock • Wiki Oficial & Base de Conhecimento</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Link to="/" style={{ color: "#8b949e", textDecoration: "none" }}>Painel Principal</Link>
          <Link to="/requisicao" style={{ color: "#8b949e", textDecoration: "none" }}>Requisição de Estoque</Link>
          <Link to="/wiki" style={{ color: "#f97316", textDecoration: "none", fontWeight: 600 }}>Wiki do Sistema</Link>
        </div>
      </footer>
    </div>
  );
}
