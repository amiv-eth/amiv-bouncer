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

const greeting = 'Welcome to the AMIV Bouncer, who takes a look at the ' +
                'list of members and decides who is in and who is not.';


const LandingPage = {
  view() {
    const message = getLogoutMessage() || greeting;
    return [
      message,
      m('a', { onclick: login }, 'Login'),
    ];
  },
};


const layout = {
  view() {
    if (getToken()) {
      return m('.container', [
        m('.header-background'),
        m('.header', [m(logo), m(apiView)]), [
          getCurrentFile() ? [
            m('.file-info-background'),
            m(fileView),
            m('.comparison', m(comparisonView)),
          ] : m(fileUploadView),
        ],
      ]);
    }
    return m(LandingPage);
  },
};


m.mount(document.body, layout);
