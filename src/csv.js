/* CSV File parsing */

import m from 'mithril';
import Papa from 'papaparse';
import { Toolbar, ToolbarTitle, Button } from 'polythene-mithril';

const uploadFieldId = 'fileinput';
let filename = '';

export const users = {
  list: [],
};

export function getCurrentFile() {
  return filename;
}
function closeFile() {
  filename = '';
  users.list = [];
}


export const fileView = {
  view() {
    return m('.file-info', m(Toolbar, { style: { color: 'grey', padding: 0 } }, [
      m(ToolbarTitle, { text: getCurrentFile() }),
      m(Button, {
        label: 'Close',
        events: { onclick: closeFile },
      }),
    ]));
  },
};

function loadFile(event) {
  if (event.target.files.length > 0) {
    // Save file (the fancy splot statement removes path)
    filename = this.value.split(/(\\|\/)/g).pop();

    Papa.parse(event.target.files[0], {
      header: true,
      complete(results) {
        // The nethz is saved in the column LOGINNAME
        users.list = results.data
          .map((everything) => everything.LOGINNAME)
          .filter(Boolean); // Remove undefined etc.
        m.redraw();
      },
    });
  }
}

// Most browsers use a file loading button which a special style, which cannot
// be changed (but doesn't really fit into our application!)
// As a solution, we use the fact that clicking on the label also opens the
// file dialog: The label is styled as a button and the actual file input
// element is hidden!
export const fileUploadView = {
  view() {
    return [
      m(
        'label.file-upload',
        {
          for: uploadFieldId,
          tabindex: 0, // tabindex allows to use 'tab' to select the label
        },
        'Click to choose file',
      ),
      m(
        'input.hide',
        {
          id: uploadFieldId,
          type: 'file',
          onchange: loadFile,
          // ondrop() { console.log('drooped'); }, // deTODO: Make this work :)
        },
        'Hidden file input.',
      ),
    ];
  },
};
