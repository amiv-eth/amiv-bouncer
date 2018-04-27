/* Main js file. */

import m from 'mithril';
import 'polythene-css/dist/polythene.css'; // Component CSS
// Default Material Design styles including Roboto font
import 'polythene-css/dist/polythene-typography.css';

import { login, getToken, getLogoutMessage, apiView } from './amivapi';
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
    const token = getToken();
    const message = getLogoutMessage();

    // If no token nor logout message, redirect to oauth login page
    const loginRequired = !token && !message;
    if (loginRequired) { login(); }

    return m('.container', [
      m('.header-background'),
      m('.header', [m(logo), token ? m(apiView) : []]),
      !loginRequired ? [
        !message ? [
          getCurrentFile() ? [
            m('.file-info-background'),
            m(fileView),
            m('.comparison', m(comparisonView)),
          ] : m(fileUploadView),
        ] : m('.error', message),
      ] : [m('.error', 'Redirecting to login page...')],
    ]);
  },
};


m.mount(document.body, layout);
