/*
 * Copyright 2016 Mirantis, Inc.
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

define([
  'intern!object',
  'intern/chai!assert',
  'tests/functional/helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, Common, Modal) {
  registerSuite(function() {
    var common, modal;

    return {
      name: 'C842467',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
          .then(function() {
            return common.getIn();
          });
      },
      beforeEach: function() {
        var clusterName = common.pickRandomName('Temp');
        return this.remote
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal
              .waitToOpen()
              .waitForCssSelector('#modal-container > .modal', 6000);
          })
          .setInputValue('[name=name]', clusterName);
      },
      'Test hypervisor:libvirt, -xen': function() {
        var rain = 'input[name=hypervisor\\:libvirt\\:rain]';
        var xen = 'input[name=hypervisor\\:xen]';

        return this.remote
          .pressKeys('\uE007')  // go to Compute

          // Enable xen, check that rain is disabled
          .clickByCssSelector(xen)
          .assertElementDisabled(rain, 'Rain checkbox is enabled with xen')

          // Disable xen, enable rain, check that xen is disabled
          .clickByCssSelector(xen)
          .clickByCssSelector(rain)
          .assertElementDisabled(xen, 'Xen checkbox is enabled with rain')

          // Create cluster with rain hypervisor
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(100);
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      }
    };
  });
});
