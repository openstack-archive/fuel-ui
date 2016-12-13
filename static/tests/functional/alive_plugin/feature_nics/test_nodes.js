/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import Modal from 'tests/functional/pages/modal';
import ClusterPage from 'tests/functional/pages/cluster';
import 'tests/functional/helpers';
import 'tests/functional/alive_plugin/plugin_helpers';

registerSuite(() => {
  var common, modal, clusterPage;

  return {
    name: 'Nodes',
    setup() {
      common = new Common(this.remote);
      modal = new Modal(this.remote);
      clusterPage = new ClusterPage(this.remote);

      return this.remote
        .then(() => common.getIn());
    },
    afterEach() {
      return this.remote
        .deleteCluster(modal);
    },
    'Set up attributes'() {
      return this.remote
        .updatePlugin('update_nodes node_setup')

        .newClusterWithPlugin(modal);
    },
    'Test attributes for Nodes'() {
      var nodeCheckbox = 'input[type=checkbox][name="attribute_checkbox"]';
      var nodeText = 'input[type=text][name="attribute_text"]';

      return this.remote
        .newClusterWithPlugin(modal)

        // Add node and open settings for it
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())

        // Verify that provided attributes are presented
        .clickByCssSelector('#headingattributes')

        .assertElementExists('.setting-section-plugin_section_a', 'Plugin section is not presented')
        .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
        .assertElementExists(nodeText, 'Input field is not presented')

        .clickByCssSelector(nodeCheckbox)
        .setInputValue(nodeText, 'some_data')

        .assertElementEnabled('button.apply-changes', 'Apply is disabled')
        .clickByCssSelector('button.apply-changes')
        .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

        .then(() => modal.close())
        .then(() => modal.waitToClose());
    },
    'Test Load defaults for Nodes'() {
      var nodeCheckbox = 'input[type=checkbox][name="attribute_checkbox"]';
      var nodeText = 'input[type=text][name="attribute_text"]';

      return this.remote
        .newClusterWithPlugin(modal)

        // Add node and open settings for it
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())

        // Change default values for attributes provided by plugin and apply the changes
        .clickByCssSelector('#headingattributes')
        .clickByCssSelector(nodeCheckbox)
        .setInputValue(nodeText, 'some_data')
        .clickByCssSelector('button.apply-changes')
        .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

        // Load Defaults and verify that default values were loaded
        .clickByCssSelector('button.btn-load-defaults')
        .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

        .assertElementExists(nodeText + '[value=""]', 'Text-input is not empty')
        .assertElementNotExists(nodeText + '[value="some_data"]', 'Text-input is not empty')
        .assertElementExists(nodeCheckbox + ':not(:checked)', 'Checkbox is still checked')

        // Save default values
        .assertElementEnabled('button.apply-changes', 'Apply is disabled')
        .clickByCssSelector('button.apply-changes')
        .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

        .then(() => modal.close())
        .then(() => modal.waitToClose());
    },
    'Test restrictions for Nodes'() {
      var nodeCheckbox = 'input[type=checkbox][name="attribute_checkbox"]';
      var nodeText = 'input[type=text][name="attribute_text"]';

      return this.remote
        .updatePlugin('update_nodes node_restrict')
        .newClusterWithPlugin(modal)

        // Add node and open settings for it
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())

        // Check that Checkbox is visible, but Text-input isn't
        .clickByCssSelector('#headingattributes')
        .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
        .assertElementNotExists(nodeText, 'Text-input is presented')

        // Enable KVM in Settings -> Compute
        .then(() => modal.close())
        .then(() => modal.waitToClose())
        .clickByCssSelector('a.settings.cluster-tab')

        .clickByCssSelector('a.subtab-link-compute')
        .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

        .clickByCssSelector('button.btn-apply-changes')
        .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

        // Open Settings for the node, check that all attributes are presented
        .then(() => clusterPage.goToTab('Nodes'))
        .clickByCssSelector('.node-settings')
        .then(() => modal.waitToOpen())
        .clickByCssSelector('#headingattributes')
        .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
        .assertElementExists(nodeText, 'Text-input is not presented')

        .then(() => modal.close())
        .then(() => modal.waitToClose());
    }
  };
});
