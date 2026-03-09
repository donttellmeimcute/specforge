<p align="center">
  <h1 align="center">⚒️ SpecForge</h1>
  <p align="center"><strong>Spec-Driven Development Framework for AI-Assisted Workflows</strong></p>
  <p align="center">
    <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="version" />
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="node" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
    <img src="https://img.shields.io/badge/TypeScript-ESM-3178c6" alt="typescript" />
  </p>
</p>

---

SpecForge es un framework CLI que estructura el desarrollo de software mediante **especificaciones** (Spec-Driven Development). Define flujos de trabajo basados en artefactos con dependencias, permite generar contenido con IA, detectar conflictos entre cambios concurrentes, exportar reportes y colaborar mediante revisiones — todo desde la terminal.

## Tabla de Contenidos

- [Filosofía](#filosofía)
- [Características](#características)
- [Instalación](#instalación)
- [Inicio Rápido](#inicio-rápido)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Referencia de Comandos CLI](#referencia-de-comandos-cli)
  - [Comandos Base](#comandos-base)
  - [Gestión de Schemas](#gestión-de-schemas)
  - [Configuración CLI](#configuración-cli)
  - [IA y Generación](#ia-y-generación)
  - [Especificaciones](#especificaciones)
  - [Monitoreo y Exportación](#monitoreo-y-exportación)
  - [Revisión Colaborativa](#revisión-colaborativa)
- [Schemas de Flujo de Trabajo](#schemas-de-flujo-de-trabajo)
  - [spec-driven (por defecto)](#spec-driven-por-defecto)
  - [tdd](#tdd)
  - [Schemas personalizados](#schemas-personalizados)
- [Referencia de Configuración](#referencia-de-configuración)
  - [Configuración del proyecto](#configuración-del-proyecto)
  - [Configuración global](#configuración-global)
- [Integración con IA](#integración-con-ia)
- [Sistema de Plugins](#sistema-de-plugins)
- [Integración con Git y Plataformas Externas](#integración-con-git-y-plataformas-externas)
  - [Funcionalidades Git](#funcionalidades-git)
  - [Integración con Asana](#integración-con-asana)
  - [Integración con GitHub (Pull Requests)](#integración-con-github-pull-requests)
  - [Uso programático (Git)](#uso-programático-git)
- [Modo Watch](#modo-watch)
  - [Uso programático (Watch)](#uso-programático-watch)
- [Validación Inteligente](#validación-inteligente)
- [Diff, Merge y Conflictos](#diff-merge-y-conflictos)
- [Exportación y Reportes](#exportación-y-reportes)
- [Flujo de Revisión Colaborativa](#flujo-de-revisión-colaborativa)
  - [Estados de revisión](#estados-de-revisión)
  - [Archivo `.review.yaml`](#archivo-reviewyaml)
  - [Uso programático (Revisión)](#uso-programático-revisión)
- [Arquitectura](#arquitectura)
- [Desarrollo](#desarrollo)

---

## Filosofía

El desarrollo guiado por especificaciones (SDD) establece que **antes de escribir código, se deben escribir especificaciones claras**. SpecForge automatiza este flujo:

1. **Proponer** — Describir qué se quiere construir y por qué
2. **Especificar** — Definir el comportamiento esperado (Given/When/Then)
3. **Diseñar** — Documentar la arquitectura técnica
4. **Planificar** — Generar tareas de implementación

Cada paso se modela como un **artefacto** en un grafo dirigido acíclico (DAG). Los artefactos tienen dependencias: no puedes escribir el diseño sin antes tener la propuesta y las specs. SpecForge rastrea el estado de cada artefacto automáticamente.

```
proposal ──→ specs ──→ tasks
         └──→ design ──┘
```

---

## Características

| Categoría | Descripción |
|-----------|-------------|
| **CLI Completa** | 17 comandos para gestionar todo el ciclo de vida |
| **Grafo de Artefactos** | DAG con ordenamiento topológico (Kahn) y detección de ciclos |
| **Schemas Flexibles** | Dos schemas built-in (`spec-driven`, `tdd`) + schemas personalizados |
| **Generación con IA** | Soporte para OpenAI, Anthropic, Ollama (local) y Claude Code (local CLI) |
| **Validación Profunda** | Scoring de completitud, consistencia de keywords, verificación de cadena |
| **Diff & Merge** | Comparar y fusionar specs entre cambios y el main |
| **Detección de Conflictos** | Identificar cambios concurrentes que tocan los mismos archivos |
| **Watch Mode** | Monitoreo en tiempo real con refresco automático de estado |
| **Sistema de Plugins** | Hooks en el ciclo de vida (init, create, archive, validate) |
| **Git Integration** | Branches automáticos, conventional commits, detección de estado |
| **Integraciones Externas**| Soporte para Asana (tracking) y GitHub CLI (Pull Requests) |
| **Revisión Colaborativa** | Flujo draft → review → approved con comentarios |
| **Exportación** | Reportes en JSON y HTML con dashboard visual |

---

## Instalación

```bash
# Clonar e instalar
git clone <repo-url> specforge
cd specforge
npm install

# Compilar
npm run build

# Link global (opcional — para usar `specforge` desde cualquier directorio)
npm link
```

### Requisitos

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0

### Dependencias opcionales

```bash
# Para integración con Asana
npm install asana dotenv

# Para integración con GitHub
npm install @octokit/rest

# Para generación con IA (instalar según el provider que uses)
npm install openai              # OpenAI (GPT-4, etc.)
npm install @anthropic-ai/sdk   # Anthropic (Claude API)
# Ollama no requiere SDK — usa fetch nativo
# Claude Code CLI: npm install -g @anthropic-ai/claude-code

# Para integración con Git
npm install simple-git
```

---

## Inicio Rápido

```bash
# 1. Inicializar SpecForge en tu proyecto
cd mi-proyecto
specforge init --context "App React con Node.js backend, PostgreSQL"

# 2. Crear un cambio
specforge new change add-authentication --tags auth security --author "dev-team"

# 3. Ver el estado de los artefactos
specforge status add-authentication

#   ⬜ proposal    (ready)
#   ⬜ specs       (pending — necesita: proposal)
#   ⬜ design      (pending — necesita: proposal)
#   ⬜ tasks       (pending — necesita: specs, design)

# 4. Obtener instrucciones para el siguiente artefacto
specforge instructions add-authentication
# → Genera un prompt detallado que puedes pasar a tu AI assistant

# 5. O generar directamente con IA
specforge generate add-authentication --provider openai

# 6. Validar el progreso
specforge validate add-authentication --deep

# 7. Cuando todo esté completo, archivar
specforge archive add-authentication
```

---

## Estructura del Proyecto

Al ejecutar `specforge init`, se crea la siguiente estructura:

```
mi-proyecto/
└── .specforge/
    ├── config.yaml              # Configuración del proyecto
    ├── specs/                   # Especificaciones principales (main)
    │   └── .gitkeep
    ├── changes/                 # Cambios activos
    │   ├── add-authentication/  # Un cambio individual
    │   │   ├── .metadata.yaml   # Metadata (status, timestamps, tags)
    │   │   ├── .review.yaml     # Estado de revisión (si aplica)
    │   │   ├── proposal.md      # Artefacto: propuesta
    │   │   ├── design.md        # Artefacto: diseño
    │   │   ├── tasks.md         # Artefacto: tareas
    │   │   └── specs/           # Delta specs para este cambio
    │   │       ├── auth/
    │   │       │   └── login.md
    │   │       └── auth/
    │   │           └── signup.md
    │   └── archive/             # Cambios archivados
    │       └── old-feature/
    └── schemas/                 # Schemas personalizados (opcional)
        └── mi-schema/
            └── schema.yaml
```

---

## Referencia de Comandos CLI

### Comandos Base

#### `specforge init`

Inicializa SpecForge en el directorio actual.

```bash
specforge init [opciones]

Opciones:
  -s, --schema <name>    Schema de flujo de trabajo (default: "spec-driven")
  -c, --context <text>   Contexto del proyecto (stack, convenciones, etc.)
```

**Ejemplo:**
```bash
specforge init --schema tdd --context "Microservicios en Go con gRPC"
```

---

#### `specforge new change <name>`

Crea un nuevo cambio con su directorio, metadata y subdirectorio de specs.

```bash
specforge new change <name> [opciones]

Argumentos:
  name                   Nombre del cambio (lowercase, alfanumérico + guiones)

Opciones:
  -s, --schema <name>    Override del schema para este cambio
  -t, --tags <tags...>   Tags de categorización
  -a, --author <name>    Identificador del autor
  --asana <taskId>       ID de la tarea de Asana para extraer info y enlazar
```

**Ejemplo:**
```bash
specforge new change add-payments --schema tdd --tags payments billing --author alice
specforge new change implement-login --asana 1234567890
```

---

#### `specforge status <change>`

Muestra el estado de los artefactos de un cambio con iconos y barra de progreso.

```bash
specforge status <change> [opciones]

Opciones:
  --json                 Salida en formato JSON
```

**Salida ejemplo:**
```
  Artifacts for "add-auth":

  ✅ proposal         completed   [proposal.md]
  🔵 specs            ready
  🔵 design           ready
  ⬜ tasks            pending

  ██████░░░░░░░░░░░░░░ 25% (1/4 completed)
```

Iconos:
- ⬜ `pending` — Dependencias no completadas
- 🔵 `ready` — Listo para comenzar
- 🔄 `in-progress` — En progreso
- ✅ `completed` — Archivos detectados

---

#### `specforge list [what]`

Lista cambios activos o archivos de especificaciones.

```bash
specforge list [what] [opciones]

Argumentos:
  what                   "changes" (default) o "specs"

Opciones:
  --all                  Incluir cambios archivados
  --json                 Salida en formato JSON
```

---

#### `specforge validate [change]`

Valida configuración, schemas, metadata y artefactos.

```bash
specforge validate [change] [opciones]

Argumentos:
  change                 Cambio específico (valida todos si se omite)

Opciones:
  --json                 Salida en formato JSON
  --deep                 Validación profunda con scoring de completitud
```

La validación estándar verifica:
- Sintaxis YAML de `config.yaml`
- Resolución del schema
- Existencia de `.metadata.yaml` en cada cambio
- Consistencia del grafo de artefactos

Con `--deep`, además:
- Verifica que artefactos "completed" tengan contenido real (>50 caracteres)
- Valida que las dependencias se completaron en orden
- Análisis de consistencia de keywords entre artefactos dependientes
- Genera un **score de 0 a 100**

---

#### `specforge archive <change>`

Archiva un cambio completado moviéndolo a `.specforge/changes/archive/`.

```bash
specforge archive <change> [opciones]

Opciones:
  --force                Archivar aunque no todos los artefactos estén completos
  --pr                   Crear un Pull Request automáticamente (usa GitHub CLI `gh`)
```

**Ejemplo:**
```bash
specforge archive add-authentication --pr
```

---

### Gestión de Schemas

#### `specforge schema list`

```bash
specforge schema list [--json]
```

Lista todos los schemas disponibles (built-in + proyecto).

#### `specforge schema show <name>`

```bash
specforge schema show <name> [--json]
```

Muestra los detalles de un schema: artefactos, dependencias, descripciones.

#### `specforge schema fork <source> <name>`

```bash
specforge schema fork <source> <name>
```

Copia un schema built-in al proyecto para personalizarlo.

**Ejemplo:**
```bash
specforge schema fork spec-driven my-workflow
# Crea .specforge/schemas/my-workflow/schema.yaml
# Ahora puedes editarlo y añadir/quitar artefactos
```

#### `specforge schema validate <name>`

```bash
specforge schema validate <name>
```

Valida la sintaxis y estructura de un schema.

#### `specforge schema which`

```bash
specforge schema which
```

Muestra qué schema está usando el proyecto actualmente.

---

### Configuración CLI

#### `specforge config show`

```bash
specforge config show [--json]
```

Muestra la configuración actual del proyecto.

#### `specforge config set <key> <value>`

```bash
specforge config set <key> <value>
```

Establece un valor de configuración. Keys soportadas: `schema`, `context`.

**Ejemplo:**
```bash
specforge config set schema tdd
specforge config set context "React 19 + Bun + Drizzle ORM"
```

---

### IA y Generación

#### `specforge instructions <change> [artifact]`

Genera un prompt enriquecido para un asistente de IA.

```bash
specforge instructions <change> [artifact] [opciones]

Opciones:
  --json                 Salida en formato JSON
```

Si no se especifica `artifact`, auto-detecta el siguiente artefacto listo. El prompt incluye:

- Descripción y requisitos del artefacto
- Contexto del proyecto
- Reglas personalizadas por artefacto
- Contenido completo de dependencias ya completadas
- Template del artefacto
- Ruta de salida esperada

---

#### `specforge generate <change> [artifact]`

Genera un artefacto completo usando IA.

```bash
specforge generate <change> [artifact] [opciones]

Opciones:
  --provider <name>      Provider de IA: openai, anthropic, ollama, claude-code
  --model <name>         Modelo específico a usar
  --dry-run              Mostrar el prompt sin llamar la IA
  --output <path>        Escribir en un archivo específico
```

**Ejemplos:**
```bash
# Generar el siguiente artefacto con OpenAI
specforge generate add-auth --provider openai --model gpt-4-turbo

# Ver qué prompt se enviaría sin ejecutar
specforge generate add-auth proposal --dry-run

# Usar Ollama local
specforge generate add-auth --provider ollama --model llama3

# Usar Claude Code local (invoca el CLI `claude`)
specforge generate add-auth --provider claude-code

# Guardar en ubicación custom
specforge generate add-auth design --output ./docs/auth-design.md
```

---

### Especificaciones

#### `specforge diff <change>`

Compara las specs de un cambio contra las specs principales.

```bash
specforge diff <change> [--json]
```

**Salida:**
```
  Diff for "add-auth":

  + auth/login.md        (added)
  ~ auth/session.md      (modified)
```

#### `specforge merge <change>`

Fusiona las specs de un cambio al directorio principal de specs.

```bash
specforge merge <change>
```

Copia todos los archivos modificados/añadidos de `.specforge/changes/<change>/specs/` a `.specforge/specs/`.

#### `specforge conflicts`

Detecta conflictos entre cambios concurrentes.

```bash
specforge conflicts [--json]
```

Analiza todos los cambios activos y reporta archivos modificados por múltiple cambios.

**Salida:**
```
  Conflicts detected:

  ⚠ auth/login.md
    Modified by: add-auth, fix-login-bug

  ⚠ payments/checkout.md
    Modified by: add-payments, redesign-checkout
```

---

### Monitoreo y Exportación

#### `specforge watch <change>`

Monitorea el directorio de un cambio y actualiza el estado automáticamente.

```bash
specforge watch <change>
```

- Detección inicial de estado al iniciar
- Refresco automático con debounce de 500ms
- Muestra iconos de estado en cada cambio de archivo
- Notifica cuando todos los artefactos están completos
- `Ctrl+C` para detener

---

#### `specforge export`

Exporta un reporte completo del proyecto.

```bash
specforge export [opciones]

Opciones:
  --format <format>      Formato: json (default) o html
  -o, --output <path>    Ruta del archivo de salida
```

**Ejemplos:**
```bash
# Exportar JSON
specforge export

# Exportar HTML con dashboard visual
specforge export --format html -o report.html
```

El reporte HTML incluye:
- Cards de métricas (total, activos, completados, archivados)
- Tabla de cambios con badges de estado
- Progreso de artefactos por cambio
- CSS inline (sin dependencias externas)

---

### Revisión Colaborativa

#### `specforge review <change> status`

Muestra el estado de revisión de un cambio.

```bash
specforge review <change> status
```

#### `specforge review <change> request`

Solicita revisión a uno o más revisores.

```bash
specforge review <change> request -r, --reviewers <names...>
```

#### `specforge review <change> comment`

Añade un comentario a la revisión.

```bash
specforge review <change> comment -a <author> -m <message> [--artifact <id>]
```

#### `specforge review <change> approve`

Aprueba un cambio.

```bash
specforge review <change> approve -a <approver>
```

Si todos los revisores aprueban, el estado cambia automáticamente a `approved`.

#### `specforge review <change> request-changes`

Solicita cambios en una revisión.

```bash
specforge review <change> request-changes -r <reviewer> -m <message>
```

**Ejemplo completo de flujo:**
```bash
# Solicitar revisión
specforge review add-auth request -r alice bob

# Alice comenta
specforge review add-auth comment -a alice -m "El diseño se ve bien" --artifact design

# Bob pide cambios
specforge review add-auth request-changes -r bob -m "Faltan edge cases en specs"

# Después de corregir, Alice y Bob aprueban
specforge review add-auth approve -a alice
specforge review add-auth approve -a bob
# → Estado: approved ✅
```

---

## Schemas de Flujo de Trabajo

Un schema define qué artefactos existen y cómo dependen entre sí. SpecForge incluye dos schemas built-in y soporta schemas personalizados.

### spec-driven (por defecto)

```
proposal ──→ specs ──→ tasks
         └──→ design ──┘
```

| Artefacto | Genera | Depende de | Descripción |
|-----------|--------|------------|-------------|
| `proposal` | `proposal.md` | — | Qué se quiere construir y por qué |
| `specs` | `specs/**/*.md` | `proposal` | Especificaciones de comportamiento (Given/When/Then) |
| `design` | `design.md` | `proposal` | Documento de diseño técnico |
| `tasks` | `tasks.md` | `specs`, `design` | Tareas de implementación con checkboxes |

### tdd

```
proposal ──→ tests ──→ implementation ──→ docs
```

| Artefacto | Genera | Depende de | Descripción |
|-----------|--------|------------|-------------|
| `proposal` | `proposal.md` | — | Propuesta del cambio |
| `tests` | `tests/**/*.md` | `proposal` | Especificaciones de test y criterios de aceptación |
| `implementation` | `implementation.md` | `tests` | Plan de implementación basado en los tests |
| `docs` | `docs.md` | `implementation` | Documentación del cambio implementado |

### Schemas personalizados

Crea un schema personalizado forkeando uno existente o creando uno nuevo:

```bash
# Forkear un schema existente
specforge schema fork spec-driven mi-flujo
```

O crea manualmente `.specforge/schemas/mi-flujo/schema.yaml`:

```yaml
name: mi-flujo
version: 1
description: "Mi flujo de trabajo personalizado"

artifacts:
  - id: research
    generates: research.md
    description: "Investigación y análisis de alternativas"
    requires: []

  - id: rfc
    generates: rfc.md
    description: "Request for Comments"
    requires: [research]

  - id: prototype
    generates: "prototype/**/*"
    description: "Prototipo funcional"
    requires: [rfc]

  - id: review-doc
    generates: review.md
    description: "Documento de revisión post-prototipo"
    requires: [prototype]
```

**Reglas de validación:**
- `name` debe ser lowercase alfanumérico con guiones
- `version` debe ser un entero positivo
- Mínimo 1 artefacto
- Los IDs de artefactos deben ser únicos
- Todas las referencias en `requires` deben apuntar a artefactos existentes
- No se permiten ciclos en el grafo de dependencias

---

## Referencia de Configuración

### Configuración del proyecto

Archivo: `.specforge/config.yaml`

```yaml
# Schema de flujo de trabajo
schema: spec-driven

# Contexto del proyecto (se incluye en los prompts de IA)
context: |
  Stack: React 19, Node.js, PostgreSQL
  Convenciones: Conventional Commits, trunk-based development
  Restricciones: Soporte para IE11 no requerido

# Reglas por artefacto (se incluyen en instrucciones/prompts)
rules:
  proposal:
    - "Incluir análisis de impacto en performance"
    - "Máximo 2 páginas"
  specs:
    - "Usar formato Given/When/Then"
    - "Incluir edge cases para error handling"
  design:
    - "Incluir diagrama de secuencia"
    - "Documentar trade-offs considerados"

# Plugins
plugins:
  - name: mi-plugin
    config:
      opcion1: valor1
```

### Configuración global

Archivo: `~/.config/specforge/config.yaml` (Linux/macOS) o `%APPDATA%/specforge/config.yaml` (Windows)

```yaml
# Schema por defecto para nuevos proyectos
defaultSchema: spec-driven

# Configuración de IA
ai:
  provider: openai          # openai | anthropic | ollama | claude-code
  model: gpt-4-turbo        # Modelo específico
  apiKey: sk-...             # API key (o usar variable de entorno)
  baseUrl: https://api.openai.com/v1/  # URL base (opcional)

# Configuración de Git
git:
  autoCommit: false          # Auto-commit al crear/modificar cambios
  autoBranch: false          # Crear branch automáticamente
  conventionalCommits: true  # Usar formato conventional commits
```

---

## Integración con IA

SpecForge se integra con tres providers de IA para generar artefactos automáticamente.

### OpenAI

```bash
# Configurar via variable de entorno
export OPENAI_API_KEY=sk-...

# O en la configuración global
specforge config set ai.provider openai
```

Modelo por defecto: `gpt-4`

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Modelo por defecto: `claude-sonnet-4-20250514`

### Ollama (local)

No requiere API key. Necesita Ollama corriendo localmente.

```bash
# Iniciar Ollama
ollama serve

# Generar con modelo local
specforge generate my-change --provider ollama --model llama3
```

URL por defecto: `http://localhost:11434`

### Claude Code (local CLI)

Usa el CLI de Claude Code instalado localmente. No requiere API key en la configuración de SpecForge — Claude Code gestiona su propia autenticación.

```bash
# Instalar Claude Code globalmente
npm install -g @anthropic-ai/claude-code

# Autenticarse (solo la primera vez)
claude auth

# Generar con Claude Code
specforge generate my-change --provider claude-code

# Con modelo específico
specforge generate my-change --provider claude-code --model claude-sonnet-4-20250514
```

Cuando se usa `claude-code`, SpecForge invoca `claude --print <prompt>` como subproceso, capturando el stdout como resultado. Esto permite usar Claude sin exponer API keys en la configuración, ya que Claude Code maneja su propia sesión.

### Flujo de generación

```
1. Cargar metadata del cambio
2. Resolver schema y construir grafo de artefactos
3. Detectar estados de artefactos en filesystem
4. Auto-seleccionar siguiente artefacto (o usar el especificado)
5. Generar prompt enriquecido con:
   - Descripción del artefacto
   - Contexto del proyecto
   - Reglas personalizadas
   - Contenido de dependencias completadas
   - Template del artefacto
6. Enviar prompt al provider de IA
7. Escribir resultado al archivo correspondiente
```

---

## Sistema de Plugins

Los plugins extienden SpecForge enganchándose en eventos del ciclo de vida.

### Hooks disponibles

| Hook | Cuándo se ejecuta |
|------|--------------------|
| `beforeInit` | Antes de crear `.specforge/` |
| `afterInit` | Después de crear `.specforge/` |
| `beforeCreateChange` | Antes de crear un cambio |
| `afterCreateChange` | Después de crear un cambio |
| `beforeArchive` | Antes de archivar un cambio |
| `afterArchive` | Después de archivar un cambio |
| `beforeValidate` | Antes de la validación |
| `afterValidate` | Después de la validación |

### Definir un plugin

```typescript
import { SpecForgePlugin } from 'specforge';

const myPlugin: SpecForgePlugin = {
  name: 'my-plugin',
  hooks: {
    afterCreateChange: async (ctx) => {
      console.log(`Cambio creado: ${ctx.changeName} en ${ctx.projectRoot}`);
      // Lógica personalizada: notificar, generar archivos extra, etc.
    },
    beforeArchive: async (ctx) => {
      // Validaciones adicionales antes de archivar
    },
  },
};
```

### Contexto del hook

```typescript
interface HookContext {
  projectRoot: string;    // Raíz del proyecto
  changeName?: string;    // Nombre del cambio (si aplica)
  changeDir?: string;     // Directorio del cambio (si aplica)
  [key: string]: unknown; // Datos adicionales
}
```

---

## Integración con Git y Plataformas Externas

> Requiere instalar dependencias adicionales dependiendo del uso (`simple-git`, `asana`, `@octokit/rest`).

### Funcionalidades Git

- **Detección automática** de repositorio Git
- **Branches por cambio**: `specforge/<change-name>` o `feat/asana-[ID]-[change-name]`
- **Conventional commits**: `feat(change): descripción`
- **Estado de archivos**: nuevo, modificado, eliminado, renombrado

### Integración con Asana

SpecForge puede auto-generar la propuesta inicial y el contexto técnico leyendo directamente de un ticket de Asana.

1. Configura el token de acceso en tus variables de entorno (`.env` o global):
```bash
export ASANA_ACCESS_TOKEN=1/12345678...
```
2. Ejecuta la creación del cambio apuntando al ID:
```bash
specforge new change add-sso --asana 120123456789
```

**Lo que hace automáticamente:**
- Crea la rama en Git (`feat/asana-120123456789-add-sso`)
- Lee el título, descripción y el usuario asignado
- Genera el `proposal.md` con esta información
- Agrega el tag `asana-120123456789` a los metadatos

### Integración con GitHub (Pull Requests)

Una vez completadas todas las tareas y especificaciones, puedes automatizar la subida a GitHub.

> Requiere tener instalada la [CLI de GitHub (`gh`)](https://cli.github.com/) e iniciada sesión.

```bash
specforge archive add-sso --pr
```

**Lo que hace automáticamente:**
- Verifica y archiva el cambio localmente
- Hace `git push -u origin HEAD`
- Lee los tags del cambio para detectar un ID de Asana (si existe)
- Ejecuta `gh pr create` con un título y cuerpo preformateado (ej: `feat: add-sso (Asana #120123456789)`)

### Uso programático (Git)

```typescript
import { createGitIntegration, conventionalCommit, changeBranchName } from 'specforge';

const git = await createGitIntegration(projectRoot);
if (git) {
  // Crear branch para un cambio
  await git.createBranch(changeBranchName('add-auth'));
  // → specforge/add-auth

  // Commit con formato conventional
  const msg = conventionalCommit('feat', 'auth', 'add login flow specs');
  await git.commit(msg);
  // → feat(auth): add login flow specs

  // Ver estado
  const files = await git.status();
  // → [{ path: '...', status: 'modified' }, ...]
}
```

---

## Modo Watch

El modo watch monitorea el directorio de un cambio y actualiza el estado de los artefactos automáticamente cuando se crean o modifican archivos.

```bash
specforge watch add-authentication
```

```
ℹ Watching change "add-authentication"... (press Ctrl+C to stop)
ℹ [watch] 0/4 artifacts completed
ℹ [watch] File changed: proposal.md
ℹ [watch] 1/4 artifacts completed
ℹ [watch] File changed: specs/auth/login.md
ℹ [watch] 2/4 artifacts completed
...
✔ [watch] All artifacts completed!
```

### Uso programático (Watch)

```typescript
import { watchChange } from 'specforge';

const controller = await watchChange(projectRoot, 'my-change', {
  debounceMs: 1000,
  onChange: (graph) => {
    const nodes = graph.getAllNodes();
    // Lógica personalizada al detectar cambios
  },
});

// Detener
controller.abort();
```

---

## Validación Inteligente

### Validación estándar

```bash
specforge validate              # Validar todo el proyecto
specforge validate add-auth     # Validar un cambio específico
```

Verifica:
- Sintaxis YAML de configuración
- Resolución del schema
- Existencia y validez de `.metadata.yaml`
- Estado del grafo de artefactos

### Validación profunda (`--deep`)

```bash
specforge validate --deep
specforge validate add-auth --deep --json
```

Análisis adicional:
- **Completitud**: Artefactos "completed" con menos de 50 caracteres se marcan como stubs
- **Cadena de dependencias**: Verifica que las dependencias se completaron antes del artefacto
- **Consistencia de keywords**: Analiza overlap de términos entre artefactos dependientes
- **Score**: Puntuación 0-100 basada en:
  - Base: % de artefactos completados
  - Penalización: -15 por error, -5 por warning

### Niveles de issues

| Nivel | Descripción | Ejemplo |
|-------|-------------|---------|
| `error` | Bloqueante | Dependencia incompleta marcada como completada |
| `warning` | Preocupante | Contenido stub, bajo overlap de keywords |
| `info` | Informativo | Artefacto en progreso |

---

## Diff, Merge y Conflictos

### Diff

Compara las specs de un cambio contra las specs principales del proyecto:

```bash
specforge diff add-auth
```

Tipos de diferencia:
- `added` — Archivo nuevo, no existe en main
- `modified` — Archivo existe en ambos con contenido diferente
- `unchanged` — Sin cambios

### Merge

Fusiona las specs de un cambio al directorio principal:

```bash
specforge merge add-auth
```

Copia todos los archivos con cambios de `.specforge/changes/add-auth/specs/` a `.specforge/specs/`.

### Detección de conflictos

```bash
specforge conflicts
```

Escanea todos los cambios activos y detecta archivos que están siendo modificados por múltiples cambios simultáneamente. Recomendado ejecutar **antes** de hacer merge.

---

## Exportación y Reportes

### JSON

```bash
specforge export
# → specforge-report.json
```

Estructura del reporte:

```json
{
  "schema": "spec-driven",
  "context": "React + Node.js",
  "changes": [
    {
      "name": "add-auth",
      "status": "active",
      "createdAt": "2026-03-06T10:00:00.000Z",
      "updatedAt": "2026-03-06T12:30:00.000Z",
      "artifacts": [
        { "id": "proposal", "status": "completed", "files": ["proposal.md"] },
        { "id": "specs", "status": "ready", "files": [] }
      ],
      "archived": false
    }
  ],
  "metrics": {
    "totalChanges": 3,
    "activeChanges": 2,
    "completedChanges": 0,
    "archivedChanges": 1
  }
}
```

### HTML

```bash
specforge export --format html -o dashboard.html
```

Genera un dashboard HTML auto-contenido con:
- Cards de métricas con números destacados
- Tabla de cambios con badges de estado por colores
- Progreso de artefactos completados vs total
- CSS embebido (sin dependencias externas)

---

## Flujo de Revisión Colaborativa

SpecForge implementa un flujo de revisión basado en archivos `.review.yaml` dentro de cada cambio.

### Estados de revisión

```
draft ──→ in-review ──→ approved
                    └──→ changes-requested ──→ in-review
```

### Archivo `.review.yaml`

```yaml
status: in-review
reviewers:
  - alice
  - bob
approvedBy:
  - alice
comments:
  - author: alice
    artifact: design
    timestamp: "2026-03-06T14:00:00.000Z"
    message: "El diagrama de secuencia está claro"
    resolved: false
  - author: bob
    artifact: specs
    timestamp: "2026-03-06T14:30:00.000Z"
    message: "Faltan edge cases para timeout"
    resolved: false
requestedAt: "2026-03-06T13:00:00.000Z"
```

### Uso programático (Revisión)

```typescript
import {
  requestReview,
  addComment,
  approveChange,
  requestChanges,
  loadReviewState,
} from 'specforge';

// Solicitar revisión
await requestReview(changeDir, ['alice', 'bob']);

// Añadir comentario
await addComment(changeDir, 'alice', 'design', 'LGTM!');

// Aprobar
const state = await approveChange(changeDir, 'alice');
// state.status → 'in-review' (falta bob)

await approveChange(changeDir, 'bob');
// state.status → 'approved' ✅

// O solicitar cambios
await requestChanges(changeDir, 'bob', 'Necesita más detalle en specs');
```

---

## API Programática

SpecForge exporta toda su funcionalidad como módulos ES para uso programático:

```typescript
import {
  // Constantes y utilidades
  SPECFORGE_DIR,
  CONFIG_FILE,
  logger,
  findProjectRoot,
  resolveSpecforgePath,

  // Grafo de artefactos
  ArtifactGraph,
  resolveSchema,
  detectArtifactStates,
  loadInstructions,

  // Inicialización y cambios
  initProject,
  createChange,
  loadChangeMetadata,
  updateChangeMetadata,

  // Configuración
  loadProjectConfig,
  saveProjectConfig,
  loadGlobalConfig,
  saveGlobalConfig,

  // Plugins
  PluginManager,

  // IA
  createAIProvider,

  // Diff, Merge, Conflictos
  diffSpecs,
  mergeSpecs,
  detectConflicts,

  // Exportación
  generateReport,
  reportToJson,
  reportToHtml,

  // Validación
  deepValidate,
  checkConsistency,

  // Git
  createGitIntegration,
  conventionalCommit,
  changeBranchName,

  // Watch
  watchChange,

  // Revisión
  loadReviewState,
  requestReview,
  addComment,
  approveChange,
  requestChanges,
} from 'specforge';
```

---

## Arquitectura

```
src/
├── cli/
│   └── index.ts                    # Punto de entrada CLI (Commander.js)
├── commands/                       # Implementación de cada comando
│   ├── init.ts                     # specforge init
│   ├── new-change.ts               # specforge new change
│   ├── status.ts                   # specforge status
│   ├── instructions.ts             # specforge instructions
│   ├── list.ts                     # specforge list
│   ├── validate.ts                 # specforge validate
│   ├── archive.ts                  # specforge archive
│   ├── schema.ts                   # specforge schema *
│   ├── config.ts                   # specforge config *
│   ├── generate.ts                 # specforge generate
│   ├── diff-merge.ts               # specforge diff / merge
│   ├── conflicts.ts                # specforge conflicts
│   ├── export.ts                   # specforge export
│   ├── watch.ts                    # specforge watch
│   └── review.ts                   # specforge review *
├── core/
│   ├── artifact-graph/
│   │   ├── types.ts                # Zod schemas y tipos TypeScript
│   │   ├── graph.ts                # ArtifactGraph (DAG + Kahn's algorithm)
│   │   ├── state.ts                # Detección de estado en filesystem
│   │   ├── resolver.ts             # Resolución de schemas (proyecto → built-in)
│   │   ├── instruction-loader.ts   # Generación de prompts para IA
│   │   ├── schemas/                # Schemas YAML built-in
│   │   │   ├── spec-driven.yaml
│   │   │   └── tdd.yaml
│   │   └── index.ts                # Barrel exports
│   ├── templates/                  # Templates de artefactos
│   │   ├── proposal.md
│   │   ├── spec.md
│   │   ├── design.md
│   │   └── tasks.md
│   ├── init.ts                     # Lógica de inicialización
│   ├── change.ts                   # CRUD de cambios
│   ├── project-config.ts           # Carga/guardado config proyecto
│   ├── global-config.ts            # Carga/guardado config global
│   ├── plugins.ts                  # Sistema de plugins y hooks
│   ├── ai-provider.ts              # Abstracción de providers IA
│   ├── diff-merge.ts               # Diff y merge de specs
│   ├── conflicts.ts                # Detección de conflictos
│   ├── export.ts                   # Generación de reportes
│   ├── smart-validate.ts           # Validación profunda con scoring
│   ├── git-integration.ts          # Integración con Git
│   ├── watch.ts                    # Modo watch (filesystem)
│   └── review.ts                   # Sistema de revisión colaborativa
├── utils/
│   ├── constants.ts                # Constantes del framework
│   ├── logger.ts                   # Logger con colores (chalk)
│   ├── file-system.ts              # Operaciones de filesystem
│   └── path-utils.ts               # Utilidades de rutas
├── types/
│   └── optional-deps.d.ts          # Declaraciones para deps opcionales
└── index.ts                        # API pública (barrel exports)
```

### Tecnologías

| Componente | Tecnología |
|------------|------------|
| Lenguaje | TypeScript 5.5+ (ESM, strict mode) |
| CLI | Commander.js 12 |
| Validación | Zod 3.23 |
| YAML | yaml 2.5 |
| Globbing | fast-glob 3.3 |
| Colores | chalk 5.3 |
| Testing | Vitest 2.0 + @vitest/coverage-v8 |
| Linting | ESLint 9 (flat config) + typescript-eslint |
| Formato | Prettier 3.3 |

---

## Desarrollo

### Scripts

```bash
npm run build          # Compilar TypeScript + copiar assets
npm run dev            # Compilación en modo watch
npm test               # Ejecutar tests
npm run test:watch     # Tests en modo watch
npm run test:coverage  # Tests con cobertura (umbral: 80%)
npm run lint           # Ejecutar ESLint
npm run format         # Formatear con Prettier
npm run clean          # Limpiar directorio dist/
```

### Tests

130 tests en 19 archivos. Cobertura configurada al 80% mínimo.

```bash
# Ejecutar todos los tests
npm test

# Con cobertura
npm run test:coverage

# Solo un archivo
npx vitest run test/core/graph.test.ts
```

Archivos de test:

```
test/
├── core/
│   ├── change.test.ts              # Creación y actualización de cambios
│   ├── conflicts.test.ts           # Detección de conflictos
│   ├── diff-merge.test.ts          # Diff y merge de specs
│   ├── export.test.ts              # Generación de reportes
│   ├── git-integration.test.ts     # Funciones de Git
│   ├── graph.test.ts               # ArtifactGraph (DAG)
│   ├── init.test.ts                # Inicialización del proyecto
│   ├── instruction-loader.test.ts  # Generación de prompts
│   ├── plugins.test.ts             # Sistema de plugins
│   ├── project-config.test.ts      # Configuración del proyecto
│   ├── resolver.test.ts            # Resolución de schemas
│   ├── review.test.ts              # Sistema de revisión
│   ├── smart-validate.test.ts      # Validación profunda
│   ├── state.test.ts               # Detección de estado
│   └── types.test.ts               # Validación de schemas Zod
└── utils/
    ├── constants.test.ts
    ├── file-system.test.ts
    ├── logger.test.ts
    └── path-utils.test.ts
```

### Contribuir

1. Fork el repositorio
2. Crea un branch: `git checkout -b mi-feature`
3. Instala dependencias: `npm install`
4. Corre los tests: `npm test`
5. Haz tus cambios y asegúrate que los tests pasen
6. Commit con conventional commits: `feat(core): add new workflow`
7. Push y abre un PR

---

## Licencia

MIT © SpecForge Contributors
