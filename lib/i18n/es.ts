/**
 * Strings en español para War Room.
 * Fork accessible-es — https://github.com/PythonLuvr/war-room
 *
 * Cuando upstream añada strings nuevos, búscalos con:
 *   grep -r "\"[A-Z][a-z]" components/ app/ --include="*.tsx" | grep -v "aria-label"
 * y añádelos aquí antes de referenciarlos en los componentes.
 */

export const t = {
  // ── Navegación y estructura ──
  nav: {
    servers: "Servidores",
    channels: "Canales",
    mainContent: "Contenido principal",
    createServer: "Crear servidor",
    inviteTeammates: "Invitar compañeros",
    settings: "Configuración",
    editServer: "Editar servidor",
  },

  // ── Canales ──
  channel: {
    createChannel: "Crear canal",
    deleteChannel: "Eliminar canal",
    renameChannel: "Renombrar canal",
    collapseGroup: (name: string) => `${name}, contraer`,
    expandGroup: (name: string) => `${name}, expandir`,
    channelCount: (n: number) => `${n} ${n === 1 ? "canal" : "canales"}`,
    searchChannels: "Buscar canales",
    pinMessage: "Fijar mensaje",
    unpinMessage: "Desfijar mensaje",
    newChannel: "Nuevo canal",
    channelName: "Nombre del canal",
    channelDescription: "Descripción",
    workingDirectory: "Directorio de trabajo",
    workingDirectoryHint: "Donde corre el agente para este canal",
    privacy: "Privacidad",
    privacyPublic: "Público",
    privacyPublicHint: "Todos en el servidor",
    privacyPrivate: "Privado",
    privacyPrivateHint: "Solo tú (por ahora)",
    browseFolders: "Explorar carpetas",
    editChannelSubtitle: "Nombre, directorio, privacidad",
  },

  // ── Chat ──
  chat: {
    messagePlaceholder: (channel: string) => `Mensaje en #${channel}`,
    sendHint: "Intro para enviar · Mayús+Intro para nueva línea",
    send: "Enviar",
    slashCommands: "Comandos de barra (próximamente)",
    attachFile: "Adjuntar archivo",
    agentTyping: "El agente está respondiendo...",
    messages: "Mensajes del canal",
    noMessages: "No hay mensajes aún",
    copyMessage: "Copiar mensaje",
    pinned: "Fijado",
  },

  // ── Agentes ──
  agent: {
    runAgent: "Ejecutar agente",
    stopAgent: "Detener agente",
    agentRunning: "Agente en ejecución",
    agentIdle: "Agente inactivo",
    newJob: "Nueva tarea",
    jobName: "Nombre de la tarea",
    approve: "Aprobar",
    reject: "Rechazar",
    approvalRequired: "Se requiere tu aprobación para continuar",
    toolCall: "Llamada a herramienta",
    thinking: "Pensando...",
    configureAgent: "Configurar agente",
  },

  // ── Configuración ──
  settings: {
    title: "Configuración",
    sync: "Sincronización",
    hosting: "Alojamiento",
    identity: "Identidad",
    appearance: "Apariencia",
    save: "Guardar",
    saving: "Guardando...",
    saveChanges: "Guardar cambios",
    saveProfile: "Guardar perfil",
    cancel: "Cancelar",
    close: "Cerrar",
    inviteLink: "Enlace de invitación",
    copyInviteLink: "Copiar enlace de invitación",
    joinTeam: "Unirse al equipo",
    tabs: {
      general: "General",
      agent: "Agente",
      sidebar: "Panel lateral",
      boardroom: "Sala de reuniones",
      sync: "Sincronización",
      about: "Acerca de",
    },
  },

  // ── Boardroom ──
  boardroom: {
    title: "Sala de reuniones",
    joinMic: "Unirse con micrófono",
    joinCam: "Unirse con cámara",
    leave: "Salir",
    mute: "Silenciar",
    unmute: "Activar micrófono",
    shareScreen: "Compartir pantalla",
  },

  // ── Estados y feedback ──
  status: {
    connecting: "Conectando...",
    connected: "Conectado",
    disconnected: "Desconectado",
    syncing: "Sincronizando...",
    error: "Error",
    success: "Completado",
    loading: "Cargando...",
    online: "En línea",
    offline: "Sin conexión",
  },

  // ── Onboarding ──
  onboarding: {
    // keys already there — keep compatible
    next: "Continuar",
    back: "Atrás",
    skip: "Omitir",
    finish: "Entrar a War Room",
    saving: "Guardando...",

    // wizard header
    setupTitle: "Configuración de War Room",
    skipLabel: "Saltar, terminar después",
    stepLabel: (n: number, total: number, name: string) => `Paso ${n} de ${total} · ${name}`,
    escHint: "Esc para saltar · ajustes guardados",
    continueDisabledHint: "Añade al menos un agente para continuar",

    // step names array (same order as wizard)
    stepNames: ["Bienvenida", "Identidad", "Agente", "Proyectos", "Sincronización"] as const,

    // Step 0 - Welcome
    welcomeTitle: "Bienvenido a War Room.",
    welcomeBody: "Este panel conecta tu agente local en una cabina compartida. Cada compañero ejecuta su propia copia. Tu agente trabaja en tu máquina, con tus archivos, tu memoria, tus herramientas.",
    welcomeHintIdentityTitle: "Identidad",
    welcomeHintIdentityBody: "Dinos quién eres.",
    welcomeHintAgentTitle: "Agente",
    welcomeHintAgentBody: "Elige entre Claude, GPT, Gemini, Grok o cualquier endpoint compatible con OpenAI.",
    welcomeHintProjectsTitle: "Proyectos",
    welcomeHintProjectsBody: "Dónde viven tus carpetas de proyectos.",
    welcomeTime: "Tarda unos 30 segundos. Puedes cambiar esto después en configuración.",

    // Step 1 - Identity
    identityTitle: "¿Quién gestiona este panel?",
    identityBody: "Elige tu rol. Así se atribuyen tus mensajes en la sala de reuniones.",
    identityOwner: "Propietario del espacio",
    identityOwnerHint: "Soy el usuario principal de esta instalación",
    identityTeammate: "Compañero",
    identityTeammateHint: "Me uno a la configuración de otra persona",
    displayNameLabel: "Tu nombre visible",
    displayNamePlaceholder: "¿Cómo quieres que te llamemos?",
    agentNameLabel: "Nombre de tu agente",
    agentNameHint: (fallback: string) => `Etiqueta en el chat y sala de reuniones. El proveedor se muestra por separado. Deja en blanco para usar ${fallback}-Agente.`,

    // Step 2 - Agent
    agentTitle: "Conecta tus agentes",
    agentBody: "War Room funciona como un servidor Discord donde cada agente conectado vive en tus canales. Añade los que quieras; aparecerán en la sala de reuniones y puedes mencionarlos con @.",
    rosterEmpty: "Tu lista está vacía.",
    rosterEmptyHint: "Conecta al menos un agente abajo para continuar. Pega una clave API o indica un ejecutable; lo que rellenes aparece aquí.",
    rosterLabel: (n: number) => `Tu lista (${n})`,
    rosterSingle: "Añade más abajo para tener varios agentes, o continúa solo con este.",
    rosterDefaultLabel: "predeterminado",
    behaviorTitle: "Capas de comportamiento opcionales",
    openWarTitle: "Usar el framework OpenWar",
    openWarBody: "Prompt inicial para usuarios sin framework propio. Añade gestión de fases, reglas de voz y confirmación antes de ejecutar. Omite si ya tienes tu propio framework.",
    primerTitle: "Enseñar a mis agentes sobre War Room",
    primerBody: "Añade un resumen del modelo de canales, decisiones, anuncios y conocimiento para que los agentes puedan usarlos. Omite si prefieres que tus agentes sean independientes.",
    behaviorFooter: "Ambas desactivadas por defecto. Actívalas por canal desde el chip de IA en la cabecera de cualquier chat, o globalmente en Configuración → Agente.",
    cliLabel: "Puente CLI",
    apiLabel: "API directa",
    noCliYet: "Aún no hay CLI oficial de este proveedor; solo API.",
    installCli: "instalar CLI",
    agentReady: "listo",

    // Step 3 - Projects
    projectsTitle: "¿Dónde viven tus proyectos?",
    projectsBody: "War Room convierte cada carpeta de proyecto en un canal de chat. Añade los que estés usando activamente. Puedes añadir más después desde la barra lateral.",
    detectedLabel: (n: number | null) => n !== null ? `Encontrados en tu máquina (${n})` : "Encontrados en tu máquina",
    scanningLabel: "Buscando en ubicaciones habituales…",
    noProjectsFound: "No se encontraron carpetas con aspecto de proyecto en las ubicaciones habituales (~/code, ~/projects, ~/Desktop, etc.). Añade una abajo.",
    manualLabel: (n: number) => `Añadidos manualmente (${n})`,
    removeProject: "Eliminar",
    addFolder: "Añadir otra carpeta...",
    addFolderHint: "Para proyectos en lugares no escaneados: una unidad diferente, OneDrive, una estructura inusual. Los que quieras.",
    noProjectsAdded: "Sin proyectos añadidos. Puedes continuar con cero y añadirlos después desde el botón + de la barra lateral.",
    projectsAdded: (n: number) => `${n} ${n === 1 ? "proyecto" : "proyectos"} se añadirán como ${n === 1 ? "canal" : "canales"} en Proyectos.`,

    // Step 4 - Sync
    syncTitle: "Sincronización (opcional)",
    syncBody1: "War Room funciona completamente en local por defecto. Tus canales, tareas, conocimiento y chats viven en ~/.war-room/app.db en tu máquina. Nada sale de ahí.",
    syncBody2: "Si quieres que tu instalación hable con la de tus compañeros en tiempo real (menciones entre máquinas, actividad compartida, presencia), ejecuta un pequeño servidor relay en un host que controles. Pega la URL abajo si tienes uno, o déjalo en blanco y trabaja en local.",
    syncUrlLabel: "URL de tu servidor de sincronización (opcional)",
    syncUrlHint: "Aloja tú mismo el servicio de sincronización. La implementación de referencia estará en el directorio tools/ del repositorio. Tus datos, tu servidor.",
    syncLocalWorksTitle: "Qué funciona en local sin sincronización:",
    syncLocalWorksBody: "Tu agente en la sala de reuniones y canales dedicados, tus tareas, decisiones y conocimiento, tus archivos, voz con LiveKit. Todo excepto visibilidad de compañeros entre máquinas.",
  },

  // ── Archivos y memoria ──
  files: {
    title: "Archivos",
    memory: "Memoria",
    addMemory: "Añadir a memoria",
    knowledge: "Conocimiento",
    restrictions: "Restricciones",
    decisions: "Decisiones",
  },

  // ── Cabecera del canal ──
  header: {
    files: "Archivos adjuntos",
    pinned: "Mensajes fijados",
    notifications: "Notificaciones",
    members: "Miembros",
    searchChannels: "Buscar en el canal",
    openInEditor: (name: string) => `Abrir proyecto en ${name}`,
    openInEditorFailed: "No se pudo abrir el editor",
    privateChannel: "privado",

    // Chip del agente
    agentChipPinned: (name: string) => `Agente principal: ${name} · Menciona otro agente en el chat para usarlo puntualmente`,
    agentChipDefault: (name: string) => `Sin agente principal · usando valor global (${name}) · menciona cualquier agente para cambiarlo en este turno`,
    agentChipOpen: "Opciones del agente",
    agentChipConfigured: "Configurado",
    agentChipNotConfigured: "Sin configurar",

    // Popover — agente principal
    primaryAI: "Agente principal del canal",
    useGlobalDefault: "Usar valor global",
    cliBridge: "Puente CLI",
    apiDirect: "API directa",
    mentionHandles: "Menciones disponibles",
    mentionHint: "Tachado = sin configurar. Activa el contexto compartido para que los agentes vean las respuestas de otros.",
    primaryHint: "El principal responde todos los mensajes de este canal. Los demás se activan con @mención para un solo turno. Los agentes sin configurar (punto gris) fallarán hasta que los actives en Configuración → Agente.",

    // Popover — contexto cruzado
    crossAgentContext: "Contexto cruzado entre agentes",
    contextIsolated: "Aislado",
    contextShared: "Compartido",
    contextIsolatedHint: "Cada agente solo ve sus propias respuestas anteriores (por defecto).",
    contextSharedHint: "Todos los agentes reciben el hilo reciente del canal como contexto, con atribución por",
    contextMaxMessages: "Máximo de mensajes",
    contextMaxChars: "Máximo de caracteres",

    // Popover — framework
    agentFramework: "Framework del agente",
    frameworkInherit: (name: string) => `Heredar valor global${name ? ` (${name})` : " (ninguno)"}`,
    frameworkNone: "Ninguno, comportamiento del modelo base",
    frameworkHint: "Framework que se antepone a cada mensaje del canal como instrucción de sistema.",
    frameworkSelectLabel: "Seleccionar framework del agente",

    // Popover — primer
    warRoomPrimer: "Indicador de War Room",
    primerInherit: (on: boolean) => `Heredar valor global (${on ? "activado" : "desactivado"})`,
    primerOn: "Activado - el agente aprende el modelo de War Room",
    primerOff: "Desactivado - agente en bruto, sin contexto de War Room",
    primerSelectLabel: "Seleccionar modo del indicador",
    primerOnDesc: "activado",
    primerOffDesc: "desactivado",
    primerHintOn: "Activo en este canal. Cuando está activo, el agente puede registrar decisiones, publicar anuncios y añadir entradas de conocimiento.",
    primerHintOff: "Inactivo en este canal.",
    primerMissing: "Archivo de indicador no incluido en esta versión. Coloca uno en presets/agent-primer/war-room.md.",

    // Popover — sub-agente
    claudeSubAgent: "Sub-agente de Claude",
    subAgentClaudePicks: "Claude elige el agente",
    subAgentSelectLabel: "Seleccionar sub-agente de Claude",
    subAgentHint: "Obliga a que cada mensaje de este canal use el agente seleccionado mediante --agent. Déjalo vacío para que Claude elija según la tarea.",

    // Popover — supervisor
    supervisorSection: "Supervisor",
    supervisorDisabled: "Desactivado",
    supervisorSelectLabel: "Seleccionar agente supervisor",
    supervisorEveryNLabel: "Cada N mensajes",
    supervisorActiveHint: (agent: string, n: number) => `${agent} lee los últimos 20 mensajes cada ${n} turnos e inyecta una nota breve de mejora.`,
    supervisorInactiveHint: "Elige un agente para activar la supervisión en tiempo real de este canal.",

    // Modal de cambio de framework
    frameworkSwitchTitle: "¿Cambiar el framework a mitad de la conversación?",
    frameworkSwitchBody: (from: string, to: string) => `Estás cambiando el framework de agente de ${from} a ${to}. El próximo turno del agente usará el nuevo framework. El contexto existente en este canal se mantiene tal cual. Los agentes CLI con memoria de sesión propia no releerán los turnos anteriores bajo las nuevas reglas.`,
    frameworkSwitchConfirm: "Cambiar framework",
    frameworkSwitchCancel: "Cancelar",
    frameworkInheritLabel: "Heredar valor global",
    frameworkNoneLabel: "Ninguno, comportamiento base",

    // Mensajes fijados
    pinnedTitle: "Mensajes fijados",
    pinnedEmpty: "Nada fijado aún. Pasa el cursor sobre cualquier mensaje y haz clic en el pin para guardarlo aquí.",
    pinnedUnpin: "Desfijar",
    pinnedYou: "tú",
    pinnedLoading: "Cargando...",
  },

  // ── Chat ──
  chatUi: {
    welcomeTitle: (channel: string) => `Bienvenido a #${channel}.`,
    welcomeStart: "Este es el inicio del canal",
    newSessionOnSend: "nueva sesión al enviar",
    sessionLive: "sesión activa · mismo contexto que VS Code",
    sendHintBar: "Intro para enviar · Mayús+Intro para nueva línea",
    stop: "Detener",
    send: "Enviar",
    slashCommands: "Comandos de barra",
    agentSupervisorNote: (agent: string) => `${agent} · nota del supervisor`,
    frameworkMissing: (id: string) => `Framework "${id}" no encontrado en presets/frameworks/. Este turno se ejecuta sin framework. Elige otro en el chip de IA.`,
    firstChatHint: (suggestion: string) => `¿Primera vez aquí? Prueba: ${suggestion}`,
    firstChatUse: "Usar esto",
    pinMessage: "Fijar mensaje",
    agentIsUser: "tú",
  },
  // ── Carril lateral (servidor) ──
  rail: {
    syncStatus: "Estado de sincronización",
    clearImage: "Borrar imagen",

    createServer: {
      title: "Crear servidor",
      subtitle: "Los servidores agrupan tus canales y categorías. Personal o compartido.",
      serverName: "Nombre del servidor",
      serverNamePlaceholder: "Nombre del espacio",
      icon: "Icono (1-2 caracteres o emoji)",
      iconPlaceholder: "auto",
      color: "Color",
      cancel: "Cancelar",
      create: "Crear",
    },

    editServer: {
      title: "Editar servidor",
      subtitle: "Cambia el nombre, el icono o el color del envoltorio.",
      warRoomLocked: "Este es el War Room oficial. El logo y el envoltorio violeta están bloqueados para mantener consistencia entre instalaciones. Puedes renombrarlo si quieres hacer un fork.",
      serverName: "Nombre del servidor",
      serverNamePlaceholder: "Nombre del espacio",
      workspaceImage: "Imagen del espacio",
      workspaceImagePlaceholder: "https://... o usa Subir",
      workspaceImageHint: "Pega una URL o sube desde tu ordenador. Si está en blanco se usa la inicial del nombre.",
      letterGlyph: "Inicial (si no hay imagen)",
      letterGlyphHint: "Bloqueado al logo de War Room.",
      letterGlyphPlaceholder: "auto",
      colorLocked: "Bloqueado al violeta de la marca.",
      color: "Color",
      cancel: "Cancelar",
      save: "Guardar",
      serverIconTitle: (name: string) => `${name} · clic derecho para editar`,
    },
  },

  // ── Menú contextual de canal ──
  channelMenu: {
    editChannel: "Editar canal…",
    makePublic: "Hacer público",
    makePrivate: "Hacer privado",
    copyChannelLink: "Copiar enlace al canal",
    deleteChannel: (name: string) => `Eliminar #${name}`,
    deleteConfirm: (name: string) => `¿Eliminar #${name}?`,
  },

  // ── Paleta de comandos ──
  commandPalette: {
    searchPlaceholder: "Buscar canales, servidores, acciones…",
    loading: "Cargando…",
    noMatches: "Sin resultados.",
    navigate: "Navegar",
    select: "Seleccionar",
    openClose: "Abrir / cerrar",

    groups: {
      channels: "Canales",
      servers: "Servidores",
      actions: "Acciones",
    },

    switchServer: "Cambiar servidor",
    goHome: "Ir al inicio de War Room",
    hintNavigate: "Navegar",
    openActivity: "Abrir actividad del sistema",
    hintSystemChannel: "Canal de sistema",
    openServices: "Abrir estado de servicios",
    openApprovals: "Abrir cola de aprobaciones",
  },

  // ── Canal de inicio ──
  home: {
    title: "Bienvenido a War Room",
    subtitle: "Cabina local · localhost · sin costes",
    vpsLabel: "VPS",
    vpsServices: "servicios activos",
    localLabel: "Local",
    localDaemons: "daemons",
    envLabel: "Env",
    envKeys: "claves cargadas",
    sessionsLabel: "Sesiones",
    sessionsTracked: "rastreadas",
    recentActivity: "Actividad reciente",
    recentActivityCount: (n: number) => `${n} ${n === 1 ? "evento" : "eventos"}`,
    activeSessions: "Sesiones activas",
    activeSessionsCount: (n: number) => `${n} rastreadas`,
    noActivity: "Sin actividad aún.",
    noSessions: "Sin sesiones. Elige un canal y envía un mensaje.",
  },

  // ── Boardroom chat ──
  boardroomChat: {
    header: "Chat de sala",
    headerHint: "menciona un agente para hablar",
    noAgents: "sin agentes configurados",
    mentionHint: (handle: string) => `Menciona un agente para hablar, p. ej. @${handle}. Escribe @ para ver los disponibles.`,
    agentNotReady: (name: string, reason: string) => `${name} no está listo: ${reason}.`,
    agentNotReadyCli: "ruta del binario no configurada en Ajustes → Agente",
    agentNotReadyApi: "clave API no configurada en Ajustes → Agente",
    agentPathPending: (name: string) => `Ruta del espacio de ${name} aún no disponible, inténtalo en un momento.`,
    agentNotConfigured: (name: string) => `${name} no configurado`,
    messagePlaceholder: "Menciona a @alguien…",
  },
} as const;
