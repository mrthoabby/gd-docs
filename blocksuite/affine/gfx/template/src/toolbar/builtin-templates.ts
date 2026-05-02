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
  const dp: number[][] = Array.from(
    {
      length: text1.length + 1,
    },
    () => Array.from({ length: text2.length + 1 }, () => 0)
  );

  for (let i = 1; i <= text1.length; i++) {
    for (let j = 1; j <= text2.length; j++) {
      if (text1[i - 1] === text2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[text1.length][text2.length];
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

        if (categroy.templates instanceof Function) {
          return categroy.templates();
        }

        return Promise.all(
          Object.entries(categroy.templates).map(async ([name, template]) => {
            if (
              lcs(keyword, (name as string).toLocaleLowerCase()) ===
              keyword.length
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
