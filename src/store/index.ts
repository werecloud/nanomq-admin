import { createPinia } from 'pinia';
import useAppStore from './modules/app';
import useNanoMQStore from './modules/nanomq';
import useUserStore from './modules/user';
import useTabBarStore from './modules/tab-bar';

const pinia = createPinia();

export { useAppStore, useNanoMQStore, useUserStore, useTabBarStore };
export default pinia;
