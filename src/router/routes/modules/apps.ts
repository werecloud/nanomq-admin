import { DEFAULT_LAYOUT } from '../base';
import { AppRouteRecordRaw } from '../types';

const NANOMQ: AppRouteRecordRaw[] = [
  {
    path: '/dashboard',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 0,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: {
          locale: 'menu.nanomq.dashboard',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-dashboard',
        },
      },
    ],
  },
  {
    path: '/clients',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 1,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'clients',
        component: () => import('@/views/clients/index.vue'),
        meta: {
          locale: 'menu.nanomq.clients',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-user',
        },
      },
    ],
  },
  {
    path: '/subscriptions',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 2,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'subscriptions',
        component: () => import('@/views/subscriptions/index.vue'),
        meta: {
          locale: 'menu.nanomq.subscriptions',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-message',
        },
      },
    ],
  },
  {
    path: '/publish',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 3,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'publish',
        component: () => import('@/views/publish/index.vue'),
        meta: {
          locale: 'menu.nanomq.publish',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-send',
        },
      },
    ],
  },
  {
    path: '/monitoring',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 4,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'monitoring',
        component: () => import('@/views/monitoring/index.vue'),
        meta: {
          locale: 'menu.nanomq.monitoring',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-computer',
        },
      },
    ],
  },
  {
    path: '/statistics',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 5,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'statistics',
        component: () => import('@/views/statistics/index.vue'),
        meta: {
          locale: 'menu.nanomq.statistics',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-bar-chart',
        },
      },
    ],
  },
  {
    path: '/configuration',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 6,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'configuration',
        component: () => import('@/views/configuration/index.vue'),
        meta: {
          locale: 'menu.nanomq.configuration',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-settings',
        },
      },
    ],
  },
  {
    path: '/access',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 7,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'access',
        component: () => import('@/views/access/index.vue'),
        meta: {
          locale: 'menu.nanomq.access',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-safe',
        },
      },
    ],
  },
  {
    path: '/rules',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 8,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'rules',
        component: () => import('@/views/rules/index.vue'),
        meta: {
          locale: 'menu.nanomq.rules',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-code-square',
        },
      },
    ],
  },
  {
    path: '/bridges',
    component: DEFAULT_LAYOUT,
    meta: {
      requiresAuth: true,
      roles: ['*'],
      order: 9,
      hideChildrenInMenu: true,
    },
    children: [
      {
        path: '',
        name: 'bridges',
        component: () => import('@/views/bridges/index.vue'),
        meta: {
          locale: 'menu.nanomq.bridges',
          requiresAuth: true,
          roles: ['*'],
          icon: 'icon-swap',
        },
      },
    ],
  },
];

export default NANOMQ;
