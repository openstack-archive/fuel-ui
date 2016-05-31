/*
 * Copyright 2015 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

import ModalWindow from 'tests/functional/pages/modal';
import 'tests/functional/helpers';

class NodeComponent {
  constructor(remote) {
    this.remote = remote;
    this.modal = new ModalWindow(this.remote);
  }

  openCompactNodeExtendedView() {
    return this.remote
      .clickByCssSelector('.compact-node .node-settings')
      .waitForCssSelector('.node-popover', 1000)
      // the following timeout as we have 0.3s transition for the popover
      .sleep(300);
  }

  openNodePopup(fromExtendedView) {
    var cssSelector = fromExtendedView ? '.node-popover' : '.node';
    return this.remote
      .findByCssSelector(cssSelector)
        .clickByCssSelector('.node-settings')
        .end()
      .then(() => this.modal.waitToOpen());
  }

  discardNode(fromExtendedView) {
    var cssSelector = fromExtendedView ? '.node-popover' : '.node';
    return this.remote
      .findByCssSelector(cssSelector)
        .clickByCssSelector('.btn-discard')
        .end()
      .then(() => this.modal.waitToOpen())
      // confirm deletion
      .clickByCssSelector('div.modal-content button.btn-delete')
      .then(() => this.modal.waitToClose());
  }

  renameNode(newName, fromExtendedView) {
    var cssSelector = fromExtendedView ? '.node-popover' : '.node';
    return this.remote
      .findByCssSelector(cssSelector)
        .clickByCssSelector('.name p')
        .findByCssSelector('input.node-name-input')
          // node name gets editable upon clicking on it
          .clearValue()
          .type(newName)
          .pressKeys('\uE007')
          .end()
        .waitForCssSelector('.name p', 2000)
        .end();
  }
}

export default NodeComponent;
