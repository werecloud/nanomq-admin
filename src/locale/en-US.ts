import localeLogin from './en-US/login';
import localeNanoMQ from './en-US/nanomq';
import localeSettings from './en-US/settings';

export default {
  'menu.dashboard': 'Dashboard',
  'menu.server.dashboard': 'Dashboard-Server',
  'menu.server.workplace': 'Workplace-Server',
  'menu.server.monitor': 'Monitor-Server',
  'menu.list': 'List',
  'menu.result': 'Result',
  'menu.exception': 'Exception',
  'menu.form': 'Form',
  'menu.profile': 'Profile',
  'menu.visualization': 'Data Visualization',
  'navbar.docs': 'Docs',
  'navbar.action.locale': 'Switch to English',
  'navbar.logout': 'Logout',
  ...localeSettings,
  ...localeLogin,
  ...localeNanoMQ,
};
