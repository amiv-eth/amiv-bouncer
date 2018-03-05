/* CSV File parsing */

import m from 'mithril';
import { Toolbar, ToolbarTitle, Button } from 'polythene-mithril';

const uploadFieldId = 'fileinput';
let filename = '';

export function getCurrentFile() {
  return filename;
}
function closeFile() {
  filename = '';
}

export const users = [
  'adietmue',
  'bconrad',
];

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

    // Create a FileReader Object
    const reader = new FileReader();

    // Add a processing function, which will be called when the
    // reader has finished parsing the file
    reader.onload = () => {
      // importFromString(reader.result);
    };

    // Start the reader
    reader.readAsText(event.target.files[0]);
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
          // ondrop() { console.log('drooped'); }, TODO: Make this work :)
        },
        'Hidden file input.',
      ),
    ];
  },
};
