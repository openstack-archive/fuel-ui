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
      name: 'C842460',
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
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', clusterName);
      },
      'Test storage, -object': function() {
        var nfs = 'input[value=storage\\:block\\:nfs]',
            cat = 'input[value=storage\\:object\\:cat]',
            sheepdog = 'input[value=storage\\:object\\:sheepdog]'

        return this.remote
          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that cat and sheepdog are disabled when nfs is enabled
          .clickByCssSelector(nfs)
          .assertElementDisabled(cat, 'Cat checkbox is enabled with nfs')
          .assertElementDisabled(sheepdog, 'Sheepdog checkbox is enabled with nfs')
//          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="cat"]' +
//                               '[data-original-title="Not compatible with nfs"]')
//          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="sheepdog"]' +
//                               '[data-original-title="Not compatible with nfs"]')

          // Check that nfs is disabled when cat and sheepdog are enabled
          .clickByCssSelector(nfs)
          .clickByCssSelector(cat)
          .assertElementDisabled(nfs, 'Nfs checkbox is enabled with cat')
//          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="nfs"]' +
//                               '[data-original-title="not compatible with cat"]')
          .clickByCssSelector(sheepdog)
          .assertElementDisabled(nfs, 'Nfs checkbox is enabled with sheepdog')
          .clickByCssSelector(cat)
//          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="nfs"]' +
//                               '[data-original-title="not compatible with sheepdog"]')
          .clickByCssSelector(sheepdog)

          // Create cluster with nfs Block Storage
          .clickByCssSelector(nfs)
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
