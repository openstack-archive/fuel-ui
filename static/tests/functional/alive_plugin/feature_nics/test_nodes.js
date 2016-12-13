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

define([
  'intern!object',
  'tests/functional/helpers',
  'tests/functional/alive_plugin/plugin_helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal',
  'tests/functional/pages/cluster'
], function(registerSuite, helpers, pluginHelpers, Common, Modal, ClusterPage) {
  'use strict';

  registerSuite(function() {
    var common, modal, clusterPage;

    return {
      name: 'Nodes',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        clusterPage = new ClusterPage(this.remote);

        return this.remote
          .then(function() {
            return common.getIn();
          });
      },
      afterEach: function() {
        return this.remote
          .deleteCluster(modal);
      },
      'Set up attributes': function() {
        return this.remote
          .updatePlugin('update_nodes node_setup')
          .newClusterWithPlugin(modal);
      },
      'Test attributes for Nodes': function() {
        var nodeCheckbox = 'input[type=checkbox][name="attribute_checkbox"]';
        var nodeText = 'input[type=text][name="attribute_text"]';

        return this.remote
          .newClusterWithPlugin(modal)

          // Add node and open settings for it
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .clickByCssSelector('.node-settings')
          .then(function() {
            return modal.waitToOpen();
          })

          // Verify that provided attributes are presented
          .clickByCssSelector('#headingattributes')

          .assertElementExists('.setting-section-plugin_section_a',
                               'Plugin section is not presented')
          .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
          .assertElementExists(nodeText, 'Input field is not presented')

          .clickByCssSelector(nodeCheckbox)
          .setInputValue(nodeText, 'some_data')

          .assertElementEnabled('button.apply-changes', 'Apply is disabled')
          .clickByCssSelector('button.apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          .then(function() {
            return modal.close();
          })
          .then(function() {
            return modal.waitToClose();
          });
      },
      'Test Load defaults for Nodes': function() {
        var nodeCheckbox = 'input[type=checkbox][name="attribute_checkbox"]';
        var nodeText = 'input[type=text][name="attribute_text"]';

        return this.remote
          .newClusterWithPlugin(modal)

          // Add node and open settings for it
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .clickByCssSelector('.node-settings')
          .then(function() {
            return modal.waitToOpen();
          })

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

          .then(function() {
            return modal.close();
          })
          .then(function() {
            return modal.waitToClose();
          });
      },
      'Test restrictions for Nodes': function() {
        var nodeCheckbox = 'input[type=checkbox][name="attribute_checkbox"]';
        var nodeText = 'input[type=text][name="attribute_text"]';

        return this.remote
          .updatePlugin('update_nodes node_restrict')
          .newClusterWithPlugin(modal)

          // Add node and open settings for it
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .clickByCssSelector('.node-settings')
          .then(function() {
            return modal.waitToOpen();
          })

          // Check that Checkbox is visible, but Text-input isn't
          .clickByCssSelector('#headingattributes')
          .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
          .assertElementNotExists(nodeText, 'Text-input is presented')

          // Enable KVM in Settings -> Compute
          .then(function() {
            return modal.close();
          })
          .then(function() {
            return modal.waitToClose();
          })
          .clickByCssSelector('a.settings.cluster-tab')

          .clickByCssSelector('a.subtab-link-compute')
          .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

          .clickByCssSelector('button.btn-apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          // Open Settings for the node, check that all attributes are presented
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .clickByCssSelector('.node-settings')
          .then(function() {
            return modal.waitToOpen();
          })
          .clickByCssSelector('#headingattributes')
          .assertElementExists(nodeCheckbox, 'Checkbox is not presented')
          .assertElementExists(nodeText, 'Text-input is not presented')

          .then(function() {
            return modal.close();
          })
          .then(function() {
            return modal.waitToClose();
          });
      }
    };
  });
});
