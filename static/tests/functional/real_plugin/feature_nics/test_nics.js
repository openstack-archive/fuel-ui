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
  'tests/functional/real_plugin/plugin_helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal',
  'tests/functional/pages/cluster'
], function(registerSuite, helpers, pluginHelpers, Common, Modal, ClusterPage) {
  'use strict';

  registerSuite(function() {
    var common, modal, clusterPage;

    return {
      name: 'NICs',
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
      'Set up all attributes': function() {
        return this.remote
         .updatePlugin('update_nics nic_setup')
         .updatePlugin('update_nodes node_setup')
         .updatePlugin('update_bonds bond_setup')

         .newClusterWithPlugin(modal);
      },
      'Test attributes for NIC interfaces': function() {
        var nicCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
        var nicText = 'input[type="text"][name="attribute_text"]';
        var itfConfigure = 'button.btn-configure-interfaces';

        return this.remote
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration,
          // verify that plugin's attributes for nics are presented
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)
          .assertAmountMatches('span.fuel_plugin_example_v5', 'span.mtu', 'Amount of plugin\'s ' +
                               'attributes does not match with interfaces amount')

          // Expand attributes of the first interface, verify that checkbox and input are available
          .selectPluginNICPropertyByIndex(0)
          .assertElementEnabled(nicCheckbox, 'Checkbox is disabled')
          .clickByCssSelector(nicCheckbox)
          .assertElementTextEquals('span.fuel_plugin_example_v5.active button', 'Enabled',
                                   'Checkbox does not enable plugin section')
          .assertElementEnabled(nicText, 'Text-input is not available to edit')
          .setInputValue(nicText, 'some_data')

          // Save changes
          .applyItfChanges();
      },
      'Test Load defaults attributes for NIC': function() {
        var nicCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
        var nicText = 'input[type="text"][name="attribute_text"]';
        var itfConfigure = 'button.btn-configure-interfaces';

        return this.remote
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Expand attributes of the first interface, enable checkbox
          .selectPluginNICPropertyByIndex(0)
          .assertElementEnabled(nicCheckbox, 'Checkbox is disabled')
          .clickByCssSelector(nicCheckbox)

          // Expand attributes of the second interface, input some text
          .selectPluginNICPropertyByIndex(1)
          .setInputValue('.ifc-list > div:nth-child(2) ' + nicText, 'some_data')

          // Save changes
          .applyItfChanges()

          // Load defaults
          .clickByCssSelector('button.btn-defaults')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)

          // Verify that defaults were loaded
          .assertElementExists('.ifc-list > div:nth-child(2) ' + nicText + '[value=""]',
                               'Text-input is not empty')
          .assertElementNotExists('.ifc-list > div:nth-child(2) ' + nicText + '[value="some_data"]',
                                  'Text-input is not empty')
          .assertElementsExist(nicCheckbox + ':not(:checked)', 2, 'Checkboxes are still checked')

          // Save with default values
          .applyItfChanges();
      },
      'Test cluster without plugin has only core attributes': function() {
        return this.remote
          // Create cluster without plugin
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', 'Temp')
          .pressKeys('\uE007') // go to Compute
          .pressKeys('\uE007') // Networking
          .pressKeys('\uE007') // Storage
          .pressKeys('\uE007') // Additional Services
          .pressKeys('\uE007') // Finish
          .pressKeys('\uE007') // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Enable KVM
          .then(function() {
            return clusterPage.goToTab('Settings');
          })
          .clickByCssSelector('a.subtab-link-compute')
          .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')
          .clickByCssSelector('button.btn-apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          // Add one node, verify that NICs plugin attributes are not presented
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector('button.btn-configure-interfaces')
          .assertElementNotExists('span.fuel_plugin_example_v5', 'NICs attributes are presented')

          // Verify that plugin attributes are not presented after bonding
          .bondInterfaces(-1, -2)
          .assertElementNotExists('span.fuel_plugin_example_v5', 'Bonds attributes are presented')
          .applyItfChanges()

          // Verify that nodes plugin attributes are not presented
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .clickByCssSelector('.node-settings')
          .then(function() {
            return modal.waitToOpen();
          })
          .clickByCssSelector('#headingattributes')

          .assertElementNotExists('.setting-section-plugin_section_a',
                                  'Plugin section is presented')
          .assertElementNotExists('input[type=checkbox][name="attribute_checkbox"]',
                                  'Checkbox is presented')
          .assertElementNotExists('input[type=text][name="attribute_text"]',
                                  'Input field is presented')

          .then(function() {
            return modal.close();
          })
          .then(function() {
            return modal.waitToClose();
          });
      },
      'Test that NIC config may be changed for several nodes simultaneously': function() {
        var nicText = 'input[type="text"][name="attribute_text"]';

        return this.remote
          .newClusterWithPlugin(modal)

          // Add two nodes, change NIC attributes for the first node
          .then(function() {
            return common.addNodesToCluster(2, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector('button.btn-configure-interfaces')
          .selectPluginNICPropertyByIndex(0)
          .setInputValue('.ifc-list > div:nth-child(1) ' + nicText, '1')
          .applyItfChanges()

          // Change NIC attributes for the second node
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .selectNodeByIndex(0)
          .selectNodeByIndex(1)
          .clickByCssSelector('button.btn-configure-interfaces')
          .selectPluginNICPropertyByIndex(1)
          .setInputValue('.ifc-list > div:nth-child(2) ' + nicText, '2')
          .applyItfChanges()

          // Select both nodes, Configure interfaces, save changes
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .selectNodeByIndex(0)
          .clickByCssSelector('button.btn-configure-interfaces')

          .selectPluginNICPropertyByIndex(0)
          .selectPluginNICPropertyByIndex(1)
          .assertElementExists('.ifc-list > div:nth-child(1) ' + nicText + '[value="1"]',
                               'Text-input is not empty')
          .assertElementExists('.ifc-list > div:nth-child(2) ' + nicText + '[value=""]',
                               'Text-input is not empty')

          .applyItfChanges();
      },
      'Test restrictions': function() {
        var nicCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
        var nicText = 'input[type="text"][name="attribute_text_r"]';
        var itfConfigure = 'button.btn-configure-interfaces';

        return this.remote
          .updatePlugin('update_nics nic_restrict')
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Expand attributes of the first interface, verify that checkbox is available
          .selectPluginNICPropertyByIndex(0)
          .clickByCssSelector(nicCheckbox)

          // Verify that text input is not displayed
          .assertElementNotExists(nicText, 'Text-input field is displayed')

          // Enable KVM
          .clickByCssSelector('a.settings.cluster-tab')
          .clickByCssSelector('button.btn-danger.proceed-btn')  // Discard changes
          .then(function() {
            return modal.waitToClose();
          })

          .clickByCssSelector('a.subtab-link-compute')
          .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

          .clickByCssSelector('button.btn-apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          // Verify that text input is displayed
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .clickByCssSelector(itfConfigure)
          .selectPluginNICPropertyByIndex(0)
          .assertElementExists(nicCheckbox, 'Checkbox is not displayed')
          .assertElementExists(nicText, 'Text-input field is not displayed');
      }
    };
  });
});
