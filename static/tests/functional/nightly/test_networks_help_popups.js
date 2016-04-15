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
  'tests/functional/pages/modal',
  'tests/functional/pages/common',
  'tests/functional/pages/cluster',
  'tests/functional/pages/dashboard',
  'intern/dojo/node!leadfoot/Command',
  'intern/dojo/node!leadfoot/Session',
  'intern/chai!assert',
  'tests/functional/nightly/library/networks'
], function(registerSuite, ModalWindow, Common, ClusterPage, DashboardPage, Command, Session, assert, NetworksLib) {
  'use strict';
  registerSuite(function() {
    var common,
      clusterPage,
      clusterName,
      networksLib;
    var popoverSelector = '.popover.in.right.requirements-popover';
    return {
      name: 'Networks extended help popups',
      'setup': function() {
        common = new Common(this.remote);
        clusterPage = new ClusterPage(this.remote);
        networksLib = new NetworksLib(this.remote);
        clusterName = common.pickRandomName('Test Cluster');

        return this.remote
          .then(function() {
            return common.getIn();
          })
          .then(function() {
            return common.createCluster(
              clusterName,
              {
                'Networking Setup': function() {
                  return this.remote
                    .clickByCssSelector('input[value*="neutron"][value$=":vlan"]')
                    .clickByCssSelector('input[value*="neutron"][value$=":tun"]');
                }
              }
            );
          })
          .then(function() {
            return clusterPage.goToTab('Networks');
          });
    },
      'Check "Admin (PXE)" network help tooltip': function() {
        var self = this;
        var adminPopoverContainer = '.fuelweb_admin .popover-container';
        var adminTooltip = adminPopoverContainer + ' i.tooltip-icon';
        var textAdmin = 'For security reasons, isolate this network from the Private and Public networks.';
        return this.remote
          .then(function() {
            return networksLib.createNetworkGroup('Network_Group_1');
            })
          .setFindTimeout(3000)
          .findByCssSelector(adminTooltip)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector, textAdmin, 'popover got wrong text');
      },
      'Check "Public" network help tooltip by css': function() {
        var self = this;
        var publicPopoverContainer = '.public .popover-container';
        var publicTooltipSelector = publicPopoverContainer + ' i.tooltip-icon';
        var textPublic = 'Public and Floating IP ranges must share the same CIDR\n' +
        'Each controller node requires one IP address from the Public IP range.\n' +
        'Additionally, an OpenStack environment requires two IP addresses to use ' +
        'as virtual IP addresses and one IP address for the default gateway.\n' +
        'If you have enabled Neutron DVR and plan to use floating IP address, ' +
        'allocate one IP address for each compute node.\n' +
        'For more information on the Public IP requirements, see Plugin documentation.';
        return this.remote
          .setFindTimeout(2000)
          .findByCssSelector(publicTooltipSelector)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector, textPublic, "Popover has wrong text");
      },
      'Check "Storage" network help tooltip': function() {
        var self = this;
        var storagePopoverContainer = '.storage .popover-container';
        var storageTooltip = storagePopoverContainer + ' i.tooltip-icon';
        var textStorage = 'This is an internal network, therefore, assign a private IP address range.';
        return this.remote
          .setFindTimeout(3000)
          .findByCssSelector(storageTooltip)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector, textStorage, "Popover has wrong text");
      },
      'Check "Managment" network help tooltip': function() {
        var self = this;
        var managmentPopoverContainer = '.management .popover-container';
        var managmentTooltip = managmentPopoverContainer + ' i.tooltip-icon';
        var textManagment = 'This is an internal network, therefore, assign a private IP address range.';
        return this.remote
          .setFindTimeout(3000)
          .findByCssSelector(managmentTooltip)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector, textManagment, "Popover has wrong text");
      },
      'Check "Neutron L2 Configuration" help tooltip': function() {
        var self = this;
        var neutron_l2PopoverContainer = '.form-neutron-l2 .popover-container';
        var neutron_l2Tooltip = neutron_l2PopoverContainer + ' i.tooltip-icon';
        var textNeutron = 'One unique Tunnel ID is required for each tenant network.';
        return this.remote
          .clickByCssSelector('.subtab-link-neutron_l2')
          .setFindTimeout(3000)
          .findByCssSelector(neutron_l2Tooltip)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector,textNeutron, 'popover got wrong text');
      },
      'Check "Floating Network Parameters" help tooltip': function() {
        var self = this;
        var floatingPopoverContainer = '.form-floating-network .popover-container';
        var floatingTooltip = floatingPopoverContainer + ' i.tooltip-icon';
        var textFloating = 'Each defined tenant, including the Admin tenant, requires one IP'  +
        ' address from the Floating range. This IP address goes to the virtual interface of ' +
        "the tenant's virtual router.";
        return this.remote
          .clickByCssSelector('.subtab-link-neutron_l3')
          .setFindTimeout(3000)
          .findByCssSelector(floatingTooltip)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector,textFloating, 'popover got wrong text');
      },
      'Check "Internal Network Parameters" help tooltip': function() {
        var self = this;
        var internalPopoverContainer = '.form-internal-network .popover-container';
        var internalTooltip = internalPopoverContainer + ' i.tooltip-icon';
        var textInternal = 'For security reasons, isolate this network from the Private and Public networks.';
        return this.remote
          .clickByCssSelector('.subtab-link-neutron_l3')
          .setFindTimeout(3000)
          .findByCssSelector(internalTooltip)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector,textInternal, 'popover got wrong text');
      },
      'Check "Guest OS DNS Servers" help tooltip': function() {
        var self = this;
        var dnsPopoverContainer = '.form-dns-nameservers .popover-container';
        var dnsTooltip = dnsPopoverContainer + ' i.tooltip-icon';
        var textDns = "This settings is used to specify Name Servers of user’s " + 
        "preference if the default servers are not prefered.";
        return this.remote
          .clickByCssSelector('.subtab-link-neutron_l3')
          .setFindTimeout(3000)
          .findByCssSelector(dnsTooltip)
            .then(function(element) {
              return self.remote.moveMouseTo(element);
            })
            .end()
          //the following timeout as we have 0.3s transition for the popover
          .sleep(300)
          .assertElementContainsText(popoverSelector,textDns, 'popover got wrong text');
      },
    };
  });
});