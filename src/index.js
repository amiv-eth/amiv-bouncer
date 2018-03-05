/* Main js file. */

import m from 'mithril';
import 'polythene-css/dist/polythene.css'; // Component CSS
// Default Material Design styles including Roboto font
import 'polythene-css/dist/polythene-typography.css';

import { auth, apiView, logoutView, loginView } from './amivapi';
import comparisonView from './comparison';
import { getCurrentFile, fileUploadView, fileView } from './csv';
import './style.css';
import logoUrl from './logo.svg';

const logo = {
  view() {
    return m(
      '.header-logo',
      m('img.header-logo-image', { src: logoUrl }, 'Logo'),
    );
  },
};

const layout = {
  view() {
    return m('.container', [
      m('.header-background'),
      auth.loggedIn ? [
        m('.header', [m(logo), m(apiView), m(logoutView)]),
        getCurrentFile() ? [
          m('.file-info-background'),
          m(fileView),
          m('.comparison', m(comparisonView)),
        ] : m(fileUploadView),
      ] : m('.login-container', m(loginView)),
    ]);
  },
};


m.mount(document.body, layout);
