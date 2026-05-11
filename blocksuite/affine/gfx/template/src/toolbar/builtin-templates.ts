/* oxlint-disable @typescript-eslint/await-thenable */
import type {
  Template,
  TemplateCategory,
  TemplateManager,
} from './template-type.js';

type SurfaceElement = Record<string, unknown>;

type ShapeConfig = {
  id: string;
  index: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shapeType?: 'rect' | 'ellipse' | 'diamond' | 'triangle';
  fillColor?: string;
  strokeColor?: string;
  radius?: number;
};

type ConnectorConfig = {
  id: string;
  index: string;
  source: string;
  target: string;
  sourcePosition?: [number, number];
  targetPosition?: [number, number];
};

function shape({
  id,
  index,
  label,
  x,
  y,
  w,
  h,
  shapeType = 'rect',
  fillColor = '--affine-palette-shape-blue',
  strokeColor = '--affine-palette-line-blue',
  radius = shapeType === 'rect' ? 0.1 : 0,
}: ShapeConfig): SurfaceElement {
  return {
    index,
    seed: 1,
    color: '--affine-palette-line-black',
    fillColor,
    filled: true,
    fontFamily: 'blocksuite:surface:Inter',
    fontSize: 14,
    maxWidth: false,
    padding: [10, 20],
    radius,
    rotate: 0,
    roughness: 1.4,
    shadow: null,
    shapeStyle: 'General',
    shapeType,
    strokeColor,
    strokeStyle: 'solid',
    strokeWidth: 2,
    text: {
      'affine:surface:text': true,
      delta: [{ insert: label }],
    },
    textResizing: 1,
    type: 'shape',
    xywh: JSON.stringify([x, y, w, h]),
    id,
  };
}

function connector({
  id,
  index,
  source,
  target,
  sourcePosition = [1, 0.5],
  targetPosition = [0, 0.5],
}: ConnectorConfig): SurfaceElement {
  return {
    index,
    seed: 1,
    frontEndpointStyle: 'None',
    mode: 1,
    rearEndpointStyle: 'Arrow',
    rough: false,
    roughness: 1.4,
    source: {
      id: source,
      position: sourcePosition,
    },
    stroke: '--affine-palette-line-grey',
    strokeStyle: 'solid',
    strokeWidth: 2,
    target: {
      id: target,
      position: targetPosition,
    },
    type: 'connector',
    id,
  };
}

function diagramSnapshot(
  title: string,
  elements: Record<string, SurfaceElement>
) {
  return {
    type: 'page',
    meta: {
      id: `template-${title.toLowerCase().replaceAll(' ', '-')}`,
      title,
      createDate: 0,
      tags: [],
    },
    blocks: {
      type: 'block',
      id: 'template-page',
      flavour: 'affine:page',
      version: 2,
      props: {
        title: {
          '$blocksuite:internal:text$': true,
          delta: [{ insert: title }],
        },
      },
      children: [
        {
          type: 'block',
          id: 'template-surface',
          flavour: 'affine:surface',
          version: 5,
          props: {
            elements,
          },
          children: [],
        },
      ],
    },
  };
}

function preview(title: string, accent: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="360" viewBox="0 0 560 360">
  <rect width="560" height="360" rx="22" fill="#17181c"/>
  <text x="32" y="48" fill="#f4f4f5" font-family="Inter,Arial" font-size="24" font-weight="700">${title}</text>
  <rect x="54" y="105" width="120" height="58" rx="12" fill="${accent}" opacity=".9"/>
  <rect x="226" y="105" width="120" height="58" rx="12" fill="#30343b" stroke="${accent}" stroke-width="3"/>
  <rect x="398" y="105" width="120" height="58" rx="12" fill="#30343b" stroke="#8a8f98" stroke-width="2"/>
  <path d="M174 134H226M346 134H398M286 163V222" stroke="#8a8f98" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)"/>
  <rect x="204" y="222" width="164" height="62" rx="12" fill="#30343b" stroke="${accent}" stroke-width="3"/>
  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#8a8f98"/></marker></defs>
</svg>`;
}

type ArchitectureComponentKind =
  | 'api'
  | 'analytics'
  | 'auth'
  | 'browser'
  | 'cache'
  | 'cdn'
  | 'ci'
  | 'cloud'
  | 'database'
  | 'dns'
  | 'docker'
  | 'email'
  | 'external'
  | 'file'
  | 'firewall'
  | 'gateway'
  | 'graphql'
  | 'grpc'
  | 'kubernetes'
  | 'lambda'
  | 'load-balancer'
  | 'logs'
  | 'mobile'
  | 'monitoring'
  | 'network'
  | 'postgres'
  | 'queue'
  | 'redis'
  | 'rest'
  | 'scheduler'
  | 'search'
  | 'secrets'
  | 'server'
  | 'service'
  | 'storage'
  | 'vpc'
  | 'webhook'
  | 'worker';

type ArchitectureComponentConfig = {
  kind: ArchitectureComponentKind;
  name: string;
  accent: string;
};

function componentIconPath(kind: ArchitectureComponentKind, accent: string) {
  switch (kind) {
    case 'analytics':
      return `<path d="M35 122h90" stroke="#f8fafc" stroke-width="7" stroke-linecap="round"/><rect x="42" y="78" width="16" height="36" rx="4" fill="${accent}"/><rect x="72" y="55" width="16" height="59" rx="4" fill="#f8fafc"/><rect x="102" y="36" width="16" height="78" rx="4" fill="${accent}"/>`;
    case 'api':
      return `<path d="M46 43h68M46 67h68M46 91h68" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><path d="M36 43l-14 14 14 14M124 43l14 14-14 14" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'auth':
      return `<path d="M80 28 125 48v33c0 28-18 44-45 55-27-11-45-27-45-55V48l45-20Z" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linejoin="round"/><path d="M66 82h28M94 82v25" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><circle cx="62" cy="82" r="11" fill="none" stroke="${accent}" stroke-width="7"/>`;
    case 'browser':
      return `<rect x="22" y="34" width="116" height="76" rx="8" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M22 56h116" stroke="#f8fafc" stroke-width="7"/><circle cx="39" cy="45" r="4" fill="${accent}"/><circle cx="54" cy="45" r="4" fill="${accent}"/><circle cx="69" cy="45" r="4" fill="${accent}"/>`;
    case 'cache':
      return `<rect x="30" y="32" width="100" height="28" rx="8" fill="none" stroke="${accent}" stroke-width="7"/><rect x="30" y="66" width="100" height="28" rx="8" fill="none" stroke="#f8fafc" stroke-width="7"/><rect x="30" y="100" width="100" height="28" rx="8" fill="none" stroke="${accent}" stroke-width="7"/>`;
    case 'cdn':
      return `<circle cx="80" cy="80" r="45" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M35 80h90M80 35c16 15 24 30 24 45s-8 30-24 45M80 35C64 50 56 65 56 80s8 30 24 45" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'ci':
      return `<path d="M32 54h32l15 22h49M32 106h32l15-22h49" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="54" r="10" fill="${accent}"/><circle cx="32" cy="106" r="10" fill="${accent}"/><path d="M119 66l14 14-14 14" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'cloud':
      return `<path d="M48 108h65a28 28 0 0 0 0-56 39 39 0 0 0-74-10A33 33 0 0 0 48 108Z" fill="none" stroke="#f8fafc" stroke-width="8" stroke-linejoin="round"/><path d="M57 84h50" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`;
    case 'database':
      return `<ellipse cx="80" cy="39" rx="49" ry="18" fill="none" stroke="${accent}" stroke-width="7"/><path d="M31 39v70c0 10 22 18 49 18s49-8 49-18V39" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M31 74c0 10 22 18 49 18s49-8 49-18" fill="none" stroke="#f8fafc" stroke-width="7"/>`;
    case 'dns':
      return `<circle cx="80" cy="80" r="45" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M58 64h44M58 80h44M58 96h44" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><circle cx="44" cy="80" r="8" fill="${accent}"/><circle cx="116" cy="80" r="8" fill="${accent}"/>`;
    case 'docker':
      return `<path d="M36 83h90c-4 25-21 40-49 40-27 0-43-12-48-36l7-4Z" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linejoin="round"/><path d="M47 67h18v16H47zM68 67h18v16H68zM89 67h18v16H89zM68 48h18v16H68zM89 48h18v16H89z" fill="${accent}"/><path d="M124 72c7-1 11 2 15 8" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'email':
      return `<rect x="29" y="44" width="102" height="78" rx="10" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M35 53l45 39 45-39" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'external':
      return `<rect x="34" y="38" width="92" height="84" rx="14" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M63 82h51M91 54l25 28-25 28" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'file':
      return `<path d="M49 28h50l26 27v77H49V28Z" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linejoin="round"/><path d="M98 30v28h27M64 83h42M64 105h34" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'firewall':
      return `<path d="M31 52h98v64H31V52Z" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M31 74h98M31 96h98M56 52v22M92 74v22M68 96v20M116 96v20" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'gateway':
      return `<path d="M80 25 132 55v50L80 135l-52-30V55l52-30Z" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M52 80h56M84 58l24 22-24 22" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'graphql':
      return `<path d="M80 31 123 56v49L80 130l-43-25V56l43-25Z" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linejoin="round"/><path d="M80 31v99M37 56l86 49M123 56l-86 49" stroke="${accent}" stroke-width="5" stroke-linecap="round"/><circle cx="80" cy="31" r="8" fill="${accent}"/><circle cx="37" cy="56" r="8" fill="${accent}"/><circle cx="123" cy="56" r="8" fill="${accent}"/><circle cx="37" cy="105" r="8" fill="${accent}"/><circle cx="123" cy="105" r="8" fill="${accent}"/><circle cx="80" cy="130" r="8" fill="${accent}"/>`;
    case 'grpc':
      return `<rect x="28" y="45" width="104" height="70" rx="14" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M48 80h26M86 63v34M86 63h25M86 80h20" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><path d="M112 63l18 17-18 17" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'kubernetes':
      return `<path d="M80 26 128 53v54L80 134l-48-27V53l48-27Z" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linejoin="round"/><circle cx="80" cy="80" r="18" fill="none" stroke="${accent}" stroke-width="7"/><path d="M80 46v17M80 97v17M50 63l15 9M95 88l15 9M110 63l-15 9M65 88l-15 9" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>`;
    case 'lambda':
      return `<path d="M47 124 80 37h16l34 87M64 82h46" fill="none" stroke="#f8fafc" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 124h30M104 124h28" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`;
    case 'load-balancer':
      return `<circle cx="80" cy="48" r="17" fill="none" stroke="${accent}" stroke-width="7"/><circle cx="42" cy="112" r="17" fill="none" stroke="#f8fafc" stroke-width="7"/><circle cx="118" cy="112" r="17" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M80 65v22M80 87H42v8M80 87h38v8" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linecap="round"/>`;
    case 'logs':
      return `<rect x="38" y="30" width="84" height="104" rx="10" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M56 58h48M56 80h48M56 102h31" stroke="${accent}" stroke-width="7" stroke-linecap="round"/><circle cx="105" cy="103" r="8" fill="${accent}"/>`;
    case 'mobile':
      return `<rect x="50" y="22" width="60" height="116" rx="13" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M68 35h24M74 122h12" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'monitoring':
      return `<rect x="28" y="39" width="104" height="76" rx="10" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M41 84h21l11-24 18 47 13-23h15" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M61 128h38" stroke="#f8fafc" stroke-width="7" stroke-linecap="round"/>`;
    case 'network':
      return `<circle cx="80" cy="42" r="14" fill="none" stroke="${accent}" stroke-width="7"/><circle cx="42" cy="116" r="14" fill="none" stroke="#f8fafc" stroke-width="7"/><circle cx="118" cy="116" r="14" fill="none" stroke="#f8fafc" stroke-width="7"/><circle cx="80" cy="86" r="14" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M80 56v16M70 95l-18 12M90 95l18 12" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'postgres':
      return `<ellipse cx="80" cy="41" rx="45" ry="17" fill="none" stroke="${accent}" stroke-width="7"/><path d="M35 41v54c0 10 20 17 45 17s45-7 45-17V41" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M53 125c20 10 44 10 62 0M80 112v17" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'queue':
      return `<path d="M31 50h98M31 80h78M31 110h58" stroke="#f8fafc" stroke-width="8" stroke-linecap="round"/><circle cx="129" cy="50" r="10" fill="${accent}"/><circle cx="109" cy="80" r="10" fill="${accent}"/><circle cx="89" cy="110" r="10" fill="${accent}"/>`;
    case 'redis':
      return `<path d="M80 35 128 58 80 81 32 58 80 35Z" fill="none" stroke="${accent}" stroke-width="7" stroke-linejoin="round"/><path d="M38 81 80 101l42-20M38 103l42 20 42-20" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'rest':
      return `<path d="M33 64h52M33 96h52" stroke="#f8fafc" stroke-width="8" stroke-linecap="round"/><path d="M101 52l22 28-22 28" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 52 44 80l22 28" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'scheduler':
      return `<circle cx="80" cy="80" r="48" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M80 51v32l24 16" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 33l-12 13M114 33l12 13" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'search':
      return `<circle cx="68" cy="68" r="35" fill="none" stroke="#f8fafc" stroke-width="8"/><path d="M94 94l32 32" stroke="${accent}" stroke-width="9" stroke-linecap="round"/><path d="M51 68h34" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'secrets':
      return `<rect x="39" y="68" width="82" height="58" rx="10" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M55 68V52c0-16 10-26 25-26s25 10 25 26v16" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><circle cx="80" cy="96" r="8" fill="${accent}"/>`;
    case 'server':
      return `<rect x="31" y="28" width="98" height="104" rx="10" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M47 55h66M47 80h66M47 105h66" stroke="${accent}" stroke-width="7" stroke-linecap="round"/><circle cx="52" cy="118" r="5" fill="#f8fafc"/>`;
    case 'service':
      return `<circle cx="80" cy="80" r="34" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M80 31v18M80 111v18M31 80h18M111 80h18M45 45l13 13M102 102l13 13M115 45l-13 13M58 102l-13 13" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'storage':
      return `<path d="M38 49h84l14 18v52H24V67l14-18Z" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linejoin="round"/><path d="M45 49v34h70V49M48 108h64" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'vpc':
      return `<rect x="28" y="32" width="104" height="96" rx="14" fill="none" stroke="#f8fafc" stroke-width="7"/><path d="M53 61h54v38H53z" fill="none" stroke="${accent}" stroke-width="7" stroke-linejoin="round"/><path d="M28 80h25M107 80h25M80 32v29M80 99v29" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    case 'webhook':
      return `<path d="M65 44a27 27 0 0 1 42 31l-10 17M54 105a27 27 0 0 1-7-51M105 116a27 27 0 0 1-44 1" fill="none" stroke="#f8fafc" stroke-width="8" stroke-linecap="round"/><circle cx="80" cy="80" r="11" fill="${accent}"/>`;
    case 'worker':
      return `<path d="M80 27v24M80 109v24M27 80h24M109 80h24M42 42l17 17M101 101l17 17M118 42l-17 17M59 101l-17 17" stroke="${accent}" stroke-width="7" stroke-linecap="round"/><circle cx="80" cy="80" r="30" fill="none" stroke="#f8fafc" stroke-width="7"/>`;
  }
}

function componentSvg({
  kind,
  name,
  accent,
}: ArchitectureComponentConfig) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="190" viewBox="0 0 240 190">
  <rect width="240" height="190" rx="24" fill="#1f2026"/>
  <rect x="18" y="18" width="204" height="154" rx="18" fill="#292b32" stroke="${accent}" stroke-width="3"/>
  <g transform="translate(40 16)">${componentIconPath(kind, accent)}</g>
  <text x="120" y="159" text-anchor="middle" fill="#f8fafc" font-family="Inter,Arial" font-size="20" font-weight="700">${name}</text>
</svg>`;
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function componentSnapshot(name: string, assetKey: string) {
  return {
    type: 'page',
    meta: {
      id: `component-${assetKey}`,
      title: name,
      createDate: 0,
      tags: [],
    },
    blocks: {
      type: 'block',
      id: `component-page-${assetKey}`,
      flavour: 'affine:page',
      version: 2,
      props: {
        title: {
          '$blocksuite:internal:text$': true,
          delta: [{ insert: name }],
        },
      },
      children: [
        {
          type: 'block',
          id: `component-surface-${assetKey}`,
          flavour: 'affine:surface',
          version: 5,
          props: {
            elements: {},
          },
          children: [
            {
              type: 'block',
              id: `component-image-${assetKey}`,
              flavour: 'affine:image',
              version: 1,
              props: {
                caption: name,
                sourceId: assetKey,
                width: 240,
                height: 190,
                index: 'a0',
                xywh: '[-120,-95,240,190]',
                rotate: 0,
                size: -1,
              },
              children: [],
            },
          ],
        },
      ],
    },
  };
}

function architectureComponent(
  config: ArchitectureComponentConfig
): Template {
  const svg = componentSvg(config);
  const assetKey = `architecture-component-${config.kind}-${slug(config.name)}`;

  return {
    name: config.name,
    type: 'sticker',
    content: () => componentSnapshot(config.name, assetKey),
    preview: svg,
    assets: () => ({
      [assetKey]: svgDataUrl(svg),
    }),
  };
}

const systemIconGroups = [
  {
    kind: 'browser',
    accent: '#38bdf8',
    names: [
      'Web Client',
      'Web App',
      'Admin Portal',
      'Backoffice',
      'Customer Portal',
      'Dashboard',
      'Browser Session',
    ],
  },
  {
    kind: 'mobile',
    accent: '#34d399',
    names: ['Mobile App', 'iOS App', 'Android App', 'Tablet App'],
  },
  {
    kind: 'service',
    accent: '#22d3ee',
    names: [
      'Microservice',
      'Core Service',
      'Billing Service',
      'User Service',
      'Notification Service',
      'Reporting Service',
      'Workflow Service',
      'Integration Service',
      'Domain Service',
      'Background Service',
    ],
  },
  {
    kind: 'api',
    accent: '#818cf8',
    names: [
      'API Service',
      'Public API',
      'Internal API',
      'Partner API',
      'Admin API',
      'BFF',
      'API Endpoint',
    ],
  },
  {
    kind: 'rest',
    accent: '#60a5fa',
    names: ['REST API', 'REST Controller', 'REST Client', 'HTTP Route', 'Web API'],
  },
  {
    kind: 'graphql',
    accent: '#f472b6',
    names: ['GraphQL API', 'GraphQL Resolver', 'GraphQL Schema', 'GraphQL Gateway'],
  },
  {
    kind: 'grpc',
    accent: '#a78bfa',
    names: ['gRPC Service', 'gRPC Client', 'RPC Gateway', 'Streaming RPC'],
  },
  {
    kind: 'server',
    accent: '#60a5fa',
    names: [
      'Server',
      'App Server',
      'Web Server',
      'Edge Server',
      'Bastion Host',
      'VM Instance',
      'Compute Node',
    ],
  },
  {
    kind: 'docker',
    accent: '#38bdf8',
    names: ['Docker', 'Container', 'Container Image', 'Compose Stack', 'Sidecar'],
  },
  {
    kind: 'kubernetes',
    accent: '#818cf8',
    names: [
      'Kubernetes',
      'Pod',
      'Deployment',
      'StatefulSet',
      'DaemonSet',
      'Namespace',
      'Cluster',
      'Ingress',
      'Service Mesh',
    ],
  },
  {
    kind: 'lambda',
    accent: '#fb923c',
    names: [
      'Function',
      'Serverless Function',
      'Event Function',
      'Worker Function',
      'Cron Function',
    ],
  },
  {
    kind: 'database',
    accent: '#facc15',
    names: [
      'Database',
      'Primary DB',
      'Read Replica',
      'SQL Database',
      'Data Warehouse',
      'OLTP Store',
      'Metadata DB',
    ],
  },
  {
    kind: 'postgres',
    accent: '#60a5fa',
    names: ['Postgres', 'Postgres Primary', 'Postgres Replica', 'Timescale DB'],
  },
  {
    kind: 'cache',
    accent: '#fb7185',
    names: [
      'Cache',
      'Memory Cache',
      'Session Cache',
      'Page Cache',
      'Edge Cache',
      'Distributed Cache',
    ],
  },
  {
    kind: 'redis',
    accent: '#ef4444',
    names: ['Redis', 'Redis Cluster', 'Redis PubSub', 'Redis Stream'],
  },
  {
    kind: 'storage',
    accent: '#fb923c',
    names: [
      'Object Storage',
      'Blob Storage',
      'Bucket',
      'Media Store',
      'Backup Store',
      'Archive Store',
      'Artifact Store',
    ],
  },
  {
    kind: 'file',
    accent: '#fbbf24',
    names: ['File Store', 'Document Store', 'File Uploads', 'Shared Drive'],
  },
  {
    kind: 'queue',
    accent: '#a78bfa',
    names: [
      'Message Queue',
      'Event Queue',
      'Task Queue',
      'Dead Letter Queue',
      'Priority Queue',
      'Stream Topic',
      'Event Bus',
    ],
  },
  {
    kind: 'scheduler',
    accent: '#f97316',
    names: ['Scheduler', 'Cron', 'Job Runner', 'Timer Trigger', 'Batch Window'],
  },
  {
    kind: 'worker',
    accent: '#22d3ee',
    names: [
      'Worker',
      'Queue Worker',
      'Sync Worker',
      'Import Worker',
      'Export Worker',
      'Image Worker',
      'Email Worker',
      'Index Worker',
    ],
  },
  {
    kind: 'load-balancer',
    accent: '#4ade80',
    names: [
      'Load Balancer',
      'Reverse Proxy',
      'Traffic Router',
      'Health Check',
      'Global Accelerator',
    ],
  },
  {
    kind: 'gateway',
    accent: '#f472b6',
    names: [
      'API Gateway',
      'Edge Gateway',
      'Service Gateway',
      'Ingress Gateway',
      'Payment Gateway',
    ],
  },
  {
    kind: 'cdn',
    accent: '#38bdf8',
    names: ['CDN', 'Static CDN', 'Media CDN', 'Edge Cache Node'],
  },
  {
    kind: 'dns',
    accent: '#93c5fd',
    names: ['DNS', 'DNS Zone', 'Domain', 'Resolver', 'Route Record'],
  },
  {
    kind: 'network',
    accent: '#34d399',
    names: ['Network', 'Subnet', 'Peering', 'NAT', 'Private Link', 'Tunnel', 'VPN'],
  },
  {
    kind: 'vpc',
    accent: '#10b981',
    names: ['VPC', 'Private Network', 'Public Subnet', 'Private Subnet', 'Security Group'],
  },
  {
    kind: 'firewall',
    accent: '#f87171',
    names: ['Firewall', 'WAF', 'ACL', 'Network Policy', 'Rate Limit'],
  },
  {
    kind: 'auth',
    accent: '#c084fc',
    names: ['Auth', 'Identity Provider', 'OAuth', 'SSO', 'Session Service', 'RBAC', 'IAM'],
  },
  {
    kind: 'secrets',
    accent: '#facc15',
    names: ['Secrets', 'Key Vault', 'KMS', 'Certificate', 'Token Store'],
  },
  {
    kind: 'search',
    accent: '#2dd4bf',
    names: ['Search', 'Search Index', 'Vector Index', 'Full Text Search', 'RAG Index'],
  },
  {
    kind: 'monitoring',
    accent: '#4ade80',
    names: ['Monitoring', 'Metrics', 'Alerting', 'Tracing', 'Observability', 'Uptime Check'],
  },
  {
    kind: 'logs',
    accent: '#94a3b8',
    names: ['Logs', 'Log Stream', 'Audit Log', 'Event Log'],
  },
  {
    kind: 'analytics',
    accent: '#f472b6',
    names: ['Analytics', 'BI Dashboard', 'ETL Pipeline', 'Data Mart', 'Metrics Store'],
  },
  {
    kind: 'email',
    accent: '#60a5fa',
    names: ['Email', 'SMTP', 'Mail Queue', 'Notification Email', 'Inbound Email'],
  },
  {
    kind: 'webhook',
    accent: '#fb7185',
    names: ['Webhook', 'Callback', 'Event Receiver', 'Outbound Webhook'],
  },
  {
    kind: 'ci',
    accent: '#a3e635',
    names: ['CI CD', 'Build Pipeline', 'Test Runner', 'Deploy Pipeline', 'Release Gate'],
  },
  {
    kind: 'cloud',
    accent: '#93c5fd',
    names: ['Cloud', 'Cloud Region', 'Availability Zone', 'Cloud Account', 'Control Plane'],
  },
  {
    kind: 'external',
    accent: '#cbd5e1',
    names: [
      'External System',
      'Third Party API',
      'SaaS App',
      'Legacy System',
      'Vendor Service',
      'Payment Processor',
    ],
  },
] satisfies Array<{
  kind: ArchitectureComponentKind;
  accent: string;
  names: string[];
}>;

const systemIconConfigs = systemIconGroups.flatMap(({ kind, accent, names }) =>
  names.map(name => ({
    kind,
    name,
    accent,
  }))
) satisfies ArchitectureComponentConfig[];

let systemIconTemplateCache: Template[] | null = null;

function getSystemIconComponents() {
  systemIconTemplateCache ??= systemIconConfigs.map(architectureComponent);
  return systemIconTemplateCache;
}

const softwareArchitecture = diagramSnapshot('Software Architecture', {
  client: shape({
    id: 'client',
    index: 'a0',
    label: 'Client',
    x: -320,
    y: -60,
    w: 140,
    h: 56,
    fillColor: '--affine-palette-shape-green',
    strokeColor: '--affine-palette-line-green',
  }),
  web: shape({
    id: 'web',
    index: 'a1',
    label: 'Web App',
    x: -80,
    y: -60,
    w: 140,
    h: 56,
  }),
  api: shape({
    id: 'api',
    index: 'a2',
    label: 'API',
    x: 160,
    y: -60,
    w: 140,
    h: 56,
    fillColor: '--affine-palette-shape-purple',
    strokeColor: '--affine-palette-line-purple',
  }),
  db: shape({
    id: 'db',
    index: 'a3',
    label: 'Database',
    x: 40,
    y: 90,
    w: 140,
    h: 56,
    shapeType: 'ellipse',
    fillColor: '--affine-palette-shape-yellow',
    strokeColor: '--affine-palette-line-yellow',
  }),
  storage: shape({
    id: 'storage',
    index: 'a4',
    label: 'Object Storage',
    x: 280,
    y: 90,
    w: 160,
    h: 56,
    fillColor: '--affine-palette-shape-orange',
    strokeColor: '--affine-palette-line-orange',
  }),
  c1: connector({ id: 'c1', index: 'a5', source: 'client', target: 'web' }),
  c2: connector({ id: 'c2', index: 'a6', source: 'web', target: 'api' }),
  c3: connector({
    id: 'c3',
    index: 'a7',
    source: 'api',
    target: 'db',
    sourcePosition: [0.35, 1],
    targetPosition: [0.5, 0],
  }),
  c4: connector({
    id: 'c4',
    index: 'a8',
    source: 'api',
    target: 'storage',
    sourcePosition: [0.85, 1],
    targetPosition: [0.5, 0],
  }),
});

const deploymentMap = diagramSnapshot('Deployment Diagram', {
  browser: shape({
    id: 'browser',
    index: 'a0',
    label: 'Browser',
    x: -360,
    y: -80,
    w: 130,
    h: 52,
    fillColor: '--affine-palette-shape-green',
    strokeColor: '--affine-palette-line-green',
  }),
  proxy: shape({
    id: 'proxy',
    index: 'a1',
    label: 'Reverse Proxy',
    x: -120,
    y: -80,
    w: 150,
    h: 52,
  }),
  app: shape({
    id: 'app',
    index: 'a2',
    label: 'App Server',
    x: 130,
    y: -80,
    w: 150,
    h: 52,
    fillColor: '--affine-palette-shape-purple',
    strokeColor: '--affine-palette-line-purple',
  }),
  postgres: shape({
    id: 'postgres',
    index: 'a3',
    label: 'Postgres',
    x: 20,
    y: 80,
    w: 130,
    h: 52,
    shapeType: 'ellipse',
    fillColor: '--affine-palette-shape-yellow',
    strokeColor: '--affine-palette-line-yellow',
  }),
  redis: shape({
    id: 'redis',
    index: 'a4',
    label: 'Redis',
    x: 210,
    y: 80,
    w: 120,
    h: 52,
    fillColor: '--affine-palette-shape-red',
    strokeColor: '--affine-palette-line-red',
  }),
  minio: shape({
    id: 'minio',
    index: 'a5',
    label: 'MinIO',
    x: 400,
    y: 80,
    w: 120,
    h: 52,
    fillColor: '--affine-palette-shape-orange',
    strokeColor: '--affine-palette-line-orange',
  }),
  c1: connector({ id: 'c1', index: 'a6', source: 'browser', target: 'proxy' }),
  c2: connector({ id: 'c2', index: 'a7', source: 'proxy', target: 'app' }),
  c3: connector({
    id: 'c3',
    index: 'a8',
    source: 'app',
    target: 'postgres',
    sourcePosition: [0.25, 1],
    targetPosition: [0.5, 0],
  }),
  c4: connector({
    id: 'c4',
    index: 'a9',
    source: 'app',
    target: 'redis',
    sourcePosition: [0.5, 1],
    targetPosition: [0.5, 0],
  }),
  c5: connector({
    id: 'c5',
    index: 'b0',
    source: 'app',
    target: 'minio',
    sourcePosition: [0.85, 1],
    targetPosition: [0.5, 0],
  }),
});

const flowchart = diagramSnapshot('Decision Flow', {
  start: shape({
    id: 'start',
    index: 'a0',
    label: 'Start',
    x: -70,
    y: -180,
    w: 140,
    h: 52,
    radius: 0.2,
    fillColor: '--affine-palette-shape-green',
    strokeColor: '--affine-palette-line-green',
  }),
  action: shape({
    id: 'action',
    index: 'a1',
    label: 'Action',
    x: -70,
    y: -70,
    w: 140,
    h: 52,
  }),
  decision: shape({
    id: 'decision',
    index: 'a2',
    label: 'Decision',
    x: -60,
    y: 40,
    w: 120,
    h: 92,
    shapeType: 'diamond',
    fillColor: '--affine-palette-shape-yellow',
    strokeColor: '--affine-palette-line-yellow',
  }),
  yes: shape({
    id: 'yes',
    index: 'a3',
    label: 'Yes Path',
    x: -230,
    y: 190,
    w: 140,
    h: 52,
    fillColor: '--affine-palette-shape-green',
    strokeColor: '--affine-palette-line-green',
  }),
  no: shape({
    id: 'no',
    index: 'a4',
    label: 'No Path',
    x: 90,
    y: 190,
    w: 140,
    h: 52,
    fillColor: '--affine-palette-shape-red',
    strokeColor: '--affine-palette-line-red',
  }),
  c1: connector({
    id: 'c1',
    index: 'a5',
    source: 'start',
    target: 'action',
    sourcePosition: [0.5, 1],
    targetPosition: [0.5, 0],
  }),
  c2: connector({
    id: 'c2',
    index: 'a6',
    source: 'action',
    target: 'decision',
    sourcePosition: [0.5, 1],
    targetPosition: [0.5, 0],
  }),
  c3: connector({
    id: 'c3',
    index: 'a7',
    source: 'decision',
    target: 'yes',
    sourcePosition: [0, 0.7],
    targetPosition: [0.5, 0],
  }),
  c4: connector({
    id: 'c4',
    index: 'a8',
    source: 'decision',
    target: 'no',
    sourcePosition: [1, 0.7],
    targetPosition: [0.5, 0],
  }),
});

export const templates: TemplateCategory[] = [
  {
    name: 'System Icons',
    templates: getSystemIconComponents,
  },
  {
    name: 'Architecture',
    templates: [
      {
        name: 'Software Architecture',
        type: 'template',
        content: softwareArchitecture,
        preview: preview('Software Architecture', '#3b82f6'),
      },
      {
        name: 'Deployment Diagram',
        type: 'template',
        content: deploymentMap,
        preview: preview('Deployment Diagram', '#10b981'),
      },
    ],
  },
  {
    name: 'Flowchart',
    templates: [
      {
        name: 'Decision Flow',
        type: 'template',
        content: flowchart,
        preview: preview('Decision Flow', '#f59e0b'),
      },
    ],
  },
];

function lcs(text1: string, text2: string) {
  let previous = Array.from({ length: text2.length + 1 }, () => 0);

  for (let i = 1; i <= text1.length; i++) {
    const current = Array.from({ length: text2.length + 1 }, () => 0);

    for (let j = 1; j <= text2.length; j++) {
      if (text1[i - 1] === text2[j - 1]) {
        current[j] = previous[j - 1] + 1;
      } else {
        current[j] = Math.max(previous[j], current[j - 1]);
      }
    }

    previous = current;
  }

  return previous[text2.length];
}

function matchesKeyword(keyword: string, candidate: string) {
  if (!keyword) return false;
  if (candidate.includes(keyword)) return true;

  return lcs(keyword, candidate) === keyword.length;
}
const extendTemplate: TemplateManager[] = [];

const flat = <T>(arr: T[][]) =>
  arr.reduce((pre, current) => {
    if (current) {
      return pre.concat(current);
    }

    return pre;
  }, []);

export const builtInTemplates = {
  list: async (category: string): Promise<Template[]> => {
    const extendTemplates = flat(
      await Promise.all(extendTemplate.map(manager => manager.list(category)))
    );

    // oxlint-disable-next-line sonarjs/no-empty-collection
    const cate = templates.find(cate => cate.name === category);
    if (!cate) return extendTemplates;

    const result: Template[] =
      cate.templates instanceof Function
        ? await cate.templates()
        : await Promise.all(Object.values(cate.templates));

    return result.concat(extendTemplates);
  },

  categories: async (): Promise<string[]> => {
    const extendCates = flat(
      await Promise.all(extendTemplate.map(manager => manager.categories()))
    );

    // oxlint-disable-next-line sonarjs/no-empty-collection
    return templates.map(cate => cate.name).concat(extendCates);
  },

  search: async (keyword: string, cateName?: string): Promise<Template[]> => {
    const candidates: Template[] = flat(
      await Promise.all(
        extendTemplate.map(manager => manager.search(keyword, cateName))
      )
    );

    keyword = keyword.trim().toLocaleLowerCase();

    await Promise.all(
      // oxlint-disable-next-line sonarjs/no-empty-collection
      templates.map(async categroy => {
        if (cateName && cateName !== categroy.name) {
          return;
        }

        const templates =
          categroy.templates instanceof Function
            ? await categroy.templates()
            : categroy.templates;

        return Promise.all(
          Object.values(templates).map(async template => {
            const searchableName = template.name?.toLocaleLowerCase() ?? '';
            const searchableCategory = categroy.name.toLocaleLowerCase();

            if (
              matchesKeyword(keyword, searchableName) ||
              matchesKeyword(keyword, searchableCategory)
            ) {
              candidates.push(template);
            }
          })
        );
      })
    );

    return candidates;
  },

  extend(manager: TemplateManager) {
    if (extendTemplate.includes(manager)) return;

    extendTemplate.push(manager);
  },
} satisfies TemplateManager;
