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
import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import React from 'react';
import i18n from 'i18n';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import Expression from 'expression';
import OffloadingModes from 'views/cluster_page_tabs/nodes_tab_screens/offloading_modes_control';
import {Input, Tooltip} from 'views/controls';
import {backboneMixin, unsavedChangesMixin} from 'component_mixins';
import {DragSource, DropTarget} from 'react-dnd';
import ReactDOM from 'react-dom';

var ns = 'cluster_page.nodes_tab.configure_interfaces.';

var EditNodeInterfacesScreen = React.createClass({
  mixins: [
    backboneMixin('interfaces', 'change reset update'),
    backboneMixin('cluster'),
    backboneMixin('nodes', 'change reset update'),
    unsavedChangesMixin
  ],
  statics: {
    fetchData(options) {
      var cluster = options.cluster;
      var nodes = utils.getNodeListFromTabOptions(options);

      if (!nodes || !nodes.areInterfacesConfigurable()) {
        return $.Deferred().reject();
      }

      var networkConfiguration = cluster.get('networkConfiguration');
      var networksMetadata = new models.ReleaseNetworkProperties();

      return $.when(...nodes.map((node) => {
        node.interfaces = new models.Interfaces();
        return node.interfaces.fetch({
          url: _.result(node, 'url') + '/interfaces',
          reset: true
        });
      }).concat([
        networkConfiguration.fetch({cache: true}),
        networksMetadata.fetch({
          url: '/api/releases/' + cluster.get('release_id') + '/networks'
        })]))
        .then(() => {
          var interfaces = new models.Interfaces();
          interfaces.set(_.cloneDeep(nodes.at(0).interfaces.toJSON()), {parse: true});
          return {
            interfaces: interfaces,
            nodes: nodes,
            bondingConfig: networksMetadata.get('bonding'),
            configModels: {
              version: app.version,
              cluster: cluster,
              settings: cluster.get('settings')
            }
          };
        });
    }
  },
  getInitialState() {
    var interfacesByIndex = {};
    var indexByInterface = {};
    var firstNodeInterfaces = this.props.interfaces.filter((ifc) => !ifc.isBond());
    this.props.nodes.each((node, nodeIndex) => {
      var justInterfaces = node.interfaces.filter((ifc) => !ifc.isBond());
      _.each(justInterfaces, (ifc, index) => {
        indexByInterface[ifc.id] = index;
        interfacesByIndex[index] = _.union(
          interfacesByIndex[index],
          [nodeIndex ? ifc : firstNodeInterfaces[index]]
        );
      });
    });
    return {
      actionInProgress: false,
      interfacesErrors: {},
      interfacesByIndex,
      indexByInterface
    };
  },
  componentWillMount() {
    this.setState({
      initialInterfaces: _.cloneDeep(this.interfacesToJSON(this.props.interfaces)),
      limitations: this.getEditLimitations()
    });
  },
  componentDidMount() {
    this.validate();
  },
  compareInterfacesProperties(interfaces, path, iteratee = _.identity,
    source = 'interface_properties') {
    // Checks if all the sub parameters are equal for all interfaces property
    var ifcProperties = _.map(
      _.map(interfaces, (ifc) => {
        var interfaceProperty = ifc.get(source);
        return _.get(interfaceProperty, path, interfaceProperty);
      }),
      iteratee
    );
    var shown = _.first(ifcProperties);
    var equal = _.all(ifcProperties, (ifcProperty) => _.isEqual(ifcProperty, shown));

    return {equal, shown};
  },
  getInterfacesLimitations(interfaces) {
    return {
      offloading_modes: this.compareInterfacesProperties(
        interfaces, '',
        (value) => utils.deepOmit(value, ['state']), 'offloading_modes'
      ),
      dpdk: this.compareInterfacesProperties(interfaces, 'dpdk.available'),
      sriov: this.compareInterfacesProperties(interfaces, 'sriov.available'),
      mtu: {equal: true, shown: true}
    };
  },
  getEditLimitations() {
    // Gets limitations for interfaces parameters editing.
    // Parameter should not be editable if it is differently available
    // across the nodes interfaces.
    // There are 3 types of interfaces to be treaten differently:
    // 1) interface (supposed to be similar on all nodes by index, unremovable)
    // 2) saved bonds (might be configured differently across the nodes,
    //    removable, affect interfaces order)
    // 3) unsaved bonds (exist on the first node only)

    var {interfacesByIndex, indexByInterface} = this.state;

    // Calculate limitations for case 1
    var result = _.reduce(
      interfacesByIndex,
      (result, interfaces) => {
        result[interfaces[0].id] = this.getInterfacesLimitations(interfaces);
        return result;
      }, {}
    );

    // Limitations for cases 2 and 3
    _.each(
      this.props.interfaces.filter((ifc) => ifc.isBond()),
      (ifc) => {
        var interfaces = _.flatten(
          _.map(ifc.getSlaveInterfaces(),
            (slave) => interfacesByIndex[indexByInterface[slave.id]]
          )
        );
        result[ifc.get('name')] = this.getInterfacesLimitations(interfaces);
      }
    );
    return result;
  },
  isLocked() {
    return !!this.props.cluster.task({group: 'deployment', active: true}) ||
      !_.all(this.props.nodes.invoke('areInterfacesConfigurable'));
  },
  interfacesPickFromJSON(json) {
    // Pick certain interface fields that have influence on hasChanges.
    return _.pick(json, [
      'assigned_networks', 'mode', 'type', 'slaves', 'bond_properties',
      'interface_properties', 'offloading_modes'
    ]);
  },
  interfacesToJSON(interfaces, remainingNodesMode) {
    // Sometimes 'state' is sent from the API and sometimes not
    // It's better to just unify all inputs to the one without state.
    var picker = remainingNodesMode ? this.interfacesPickFromJSON : (json) => _.omit(json, 'state');
    return interfaces.map((ifc) => picker(ifc.toJSON()));
  },
  hasChangesInRemainingNodes() {
    var initialInterfacesData = _.map(this.state.initialInterfaces, this.interfacesPickFromJSON);
    var limitationsKeys = this.props.nodes.at(0).interfaces.map(
      (ifc) => ifc.get(ifc.isBond ? 'name' : 'id')
    );

    return _.any(this.props.nodes.slice(1), (node) => {
      var interfacesData = this.interfacesToJSON(node.interfaces, true);
      return _.any(initialInterfacesData, (ifcData, index) => {
        var limitations = this.state.limitations[limitationsKeys[index]];
        var omittedProperties = _.filter(
          _.keys(limitations),
          (key) => !_.get(limitations[key], 'equal', true)
        );
        return _.any(ifcData, (data, attribute) => {
          // Restricted parameters should not participate in changes detection
          switch (attribute) {
            case 'offloading_modes': {
              // Do not compare offloading modes if they differ
              if (!_.get(limitations, 'offloading_modes.equal', false)) return false;
              // otherwise remove set states before it
              return !_.isEqual(..._.invoke(
                  [data, interfacesData[index][attribute]],
                  (value) => utils.deepOmit(value, ['state']))
              );
            }
            case 'interface_properties': {
              // Omit restricted parameters from the comparison
              return !_.isEqual(..._.invoke(
                [data, interfacesData[index][attribute]],
                _.omit, omittedProperties)
              );
            }
            case 'slaves': {
              // bond 'slaves' attribute contains information about slave name only
              // but interface names can be different between nodes
              // and can not be used for the comparison
              return data.length !== (interfacesData[index].slaves || {}).length;
            }
          }
          return !_.isEqual(data, interfacesData[index][attribute]);
        });
      });
    });
  },
  hasChanges() {
    return !this.isLocked() &&
      (!_.isEqual(this.state.initialInterfaces, this.interfacesToJSON(this.props.interfaces)) ||
      this.props.nodes.length > 1 && this.hasChangesInRemainingNodes());
  },
  loadDefaults() {
    this.setState({actionInProgress: true});
    $.when(this.props.interfaces.fetch({
      url: _.result(this.props.nodes.at(0), 'url') + '/interfaces/default_assignment', reset: true
    })).done(() => {
      this.setState({actionInProgress: false});
    }).fail((response) => {
      var errorNS = ns + 'configuration_error.';
      utils.showErrorDialog({
        title: i18n(errorNS + 'title'),
        message: i18n(errorNS + 'load_defaults_warning'),
        response: response
      });
    });
  },
  revertChanges() {
    this.props.interfaces.reset(_.cloneDeep(this.state.initialInterfaces), {parse: true});
  },
  updateWithLimitations(sourceInterface, targetInterface) {
    // Interface parameters should be updated with respect to limitations:
    // restricted parameters should not be changed
    var limitations = this.state.limitations[targetInterface.id];
    var targetInterfaceProperties = targetInterface.get('interface_properties');
    var sourceInterfaceProperties = sourceInterface.get('interface_properties');

    if (targetInterface.get('offloading_modes')
        && _.get(limitations, 'offloading_modes.equal', false)) {
      targetInterface.set({
        offloading_modes: sourceInterface.get('offloading_modes')
      });
      // If set of offloading modes supported is the same, disable_offloading
      // parameters updated as well (it is probably obsolete)
      var disableOffloading = _.get(sourceInterfaceProperties, 'disable_offloading');
      if (!_.isUndefined(disableOffloading)) {
        _.set(targetInterfaceProperties, 'disable_offloading', disableOffloading);
      }
    }

    _.each(sourceInterfaceProperties, (propertyValue, propertyName) => {
      // Set all unrestricted parameters values
      if (!_.isPlainObject(propertyValue)
          && _.get(limitations, propertyName + '.equal', false)) {
        _.set(targetInterfaceProperties, propertyName, propertyValue);
      }
    });
    targetInterface.set({
      interface_properties: sourceInterfaceProperties
    });
  },
  applyChanges() {
    if (!this.isSavingPossible()) return $.Deferred().reject();

    var nodes = this.props.nodes;
    var interfaces = this.props.interfaces;
    var bond = interfaces.filter((ifc) => ifc.isBond());
    var bondsByName = bond.reduce((result, bond) => {
      result[bond.get('name')] = bond;
      return result;
    }, {});

    // bonding map contains indexes of slave interfaces
    // it is needed to build the same configuration for all the nodes
    // as interface names might be different, so we use indexes
    var bondingMap = _.map(bond,
      (bond) => _.map(bond.get('slaves'), (slave) => interfaces.indexOf(interfaces.find(slave)))
    );

    this.setState({actionInProgress: true});
    return $.when(...nodes.map((node) => {
      var oldNodeBonds, nodeBonds;
      // removing previously configured bond
      oldNodeBonds = node.interfaces.filter((ifc) => ifc.isBond());
      node.interfaces.remove(oldNodeBonds);
      // creating node-specific bond without slaves
      nodeBonds = _.map(bond, (bond) => {
        return new models.Interface(_.omit(bond.toJSON(), 'slaves'), {parse: true});
      });
      node.interfaces.add(nodeBonds);
      // determining slaves using bonding map
      _.each(nodeBonds, (bond, bondIndex) => {
        var slaveIndexes = bondingMap[bondIndex];
        var slaveInterfaces = _.map(slaveIndexes, node.interfaces.at, node.interfaces);
        bond.set({slaves: _.invoke(slaveInterfaces, 'pick', 'name')});
      });

      // Assigning networks according to user choice and interface properties
      node.interfaces.each((ifc, index) => {
        var updatedIfc = ifc.isBond() ? bondsByName[ifc.get('name')] : interfaces.at(index);
        ifc.set({
          assigned_networks: new models.InterfaceNetworks(
            updatedIfc.get('assigned_networks').toJSON()
          )
        });
        this.updateWithLimitations(updatedIfc, ifc);
      });

      return Backbone.sync('update', node.interfaces, {url: _.result(node, 'url') + '/interfaces'});
    }))
      .done(() => {
        this.setState({initialInterfaces:
          _.cloneDeep(this.interfacesToJSON(this.props.interfaces))});
        dispatcher.trigger('networkConfigurationUpdated');
      })
      .fail((response) => {
        var errorNS = ns + 'configuration_error.';

        utils.showErrorDialog({
          title: i18n(errorNS + 'title'),
          message: i18n(errorNS + 'saving_warning'),
          response: response
        });
      }).always(() => this.setState({actionInProgress: false}));
  },
  configurationTemplateExists() {
    return !_.isEmpty(this.props.cluster.get('networkConfiguration')
      .get('networking_parameters').get('configuration_template'));
  },
  getAvailableBondingTypes(ifc) {
    if (ifc.isBond()) return [ifc.get('bond_properties').type__];

    return _.compact(
      _.flatten(
        _.map(
          this.props.bondingConfig.availability,
          (modesAvailability) => _.map(
            modesAvailability,
            (condition, mode) => (new Expression(
              condition, this.props.configModels, {strict: false}
            )).evaluate({interface: ifc}) && mode
          )
    )));
  },
  findOffloadingModesIntersection(set1, set2) {
    return _.map(
      _.intersection(
        _.map(set1, 'name'),
        _.map(set2, 'name')
      ),
      (name) => {
        return {
          name: name,
          state: null,
          sub: this.findOffloadingModesIntersection(
            _.find(set1, {name: name}).sub,
            _.find(set2, {name: name}).sub
          )
        };
      });
  },
  getIntersectedOffloadingModes(interfaces) {
    var offloadingModes = interfaces.map((ifc) => ifc.get('offloading_modes') || []);
    if (!offloadingModes.length) return [];

    return offloadingModes.reduce((result, modes) => {
      return this.findOffloadingModesIntersection(result, modes);
    });
  },
  bondInterfaces(bondType) {
    this.setState({actionInProgress: true});
    var interfaces = this.props.interfaces.filter((ifc) => ifc.get('checked') && !ifc.isBond());
    var bond = this.props.interfaces.find((ifc) => ifc.get('checked') && ifc.isBond());
    var limitations = this.state.limitations;
    var bondName;

    if (!bond) {
      // if no bond selected - create new one
      var bondMode = _.flatten(
        _.map(this.props.bondingConfig.properties[bondType].mode, 'values')
      )[0];
      bondName = this.props.interfaces.generateBondName('bond');

      bond = new models.Interface({
        type: 'bond',
        name: bondName,
        mode: bondMode,
        assigned_networks: new models.InterfaceNetworks(),
        slaves: _.invoke(interfaces, 'pick', 'name'),
        bond_properties: {
          mode: bondMode,
          type__: bondType
        },
        interface_properties: {
          mtu: null,
          disable_offloading: true,
          dpdk: {
            enabled: _.all(interfaces,
              (ifc) => ifc.get('interface_properties').dpdk.enabled
            ),
            available: _.all(interfaces,
              (ifc) => ifc.get('interface_properties').dpdk.available
            )
          }
        },
        offloading_modes: this.getIntersectedOffloadingModes(interfaces)
      });
      limitations[bondName] = {};
    } else {
      // adding interfaces to existing bond
      var bondProperties = _.cloneDeep(bond.get('interface_properties'));
      bondName = bond.get('name');

      if (bondProperties.dpdk.enabled) {
        bondProperties.dpdk.enabled = _.all(interfaces,
          (ifc) => ifc.get('interface_properties').dpdk.enabled
        );
      }
      bond.set({
        slaves: bond.get('slaves').concat(_.invoke(interfaces, 'pick', 'name')),
        offloading_modes: this.getIntersectedOffloadingModes(interfaces.concat(bond)),
        interface_properties: bondProperties
      });
      // remove the bond to add it later and trigger re-rendering
      this.props.interfaces.remove(bond, {silent: true});
    }
    limitations[bondName] = _.reduce(interfaces, (result, ifc) => {
      bond.get('assigned_networks').add(ifc.get('assigned_networks').models);
      ifc.get('assigned_networks').reset();
      ifc.set({checked: false});
      return this.mergeLimitations(result, limitations[ifc.id]);
    }, limitations[bondName]);

    this.props.interfaces.add(bond);
    this.setState({
      actionInProgress: false,
      limitations: limitations
    });
  },
  mergeLimitations(limitation1, limitation2) {
    return _.merge(limitation1, limitation2, (value1, value2, interfaceProperty) => {
      switch (interfaceProperty) {
        case 'mtu':
        case 'offloading_modes':
          // Offloading modes are presumed to be calculated intersection
          return {equal: true, shown: true};
        case 'dpdk':
          if (_.isUndefined(value1) || _.isUndefined(value2)) break;

          // Both interfaces should support DPDK in order bond to support it either
          var equal = true;
          var shown = value1.shown && value2.shown;
          return {equal: equal, shown: shown};
        case 'sriov':
          return {equal: true, shown: false};
      }
    });
  },
  unbondInterfaces() {
    this.setState({actionInProgress: true});
    _.each(this.props.interfaces.where({checked: true}), (bond) => {
      this.removeInterfaceFromBond(bond.get('name'));
    });
    this.setState({actionInProgress: false});
  },
  removeInterfaceFromBond(bondName, slaveInterfaceName) {
    var networks = this.props.cluster.get('networkConfiguration').get('networks');
    var bond = this.props.interfaces.find({name: bondName});
    var slaves = bond.get('slaves');
    var bondHasUnmovableNetwork = bond.get('assigned_networks').any((interfaceNetwork) => {
      return interfaceNetwork.getFullNetwork(networks).get('meta').unmovable;
    });
    var slaveInterfaceNames = _.map(slaves, 'name');
    var targetInterface = bond;

    // if PXE interface is being removed - place networks there
    if (bondHasUnmovableNetwork) {
      var pxeInterface = this.props.interfaces.find((ifc) => {
        return ifc.get('pxe') && _.contains(slaveInterfaceNames, ifc.get('name'));
      });
      if (!slaveInterfaceName || pxeInterface && pxeInterface.get('name') === slaveInterfaceName) {
        targetInterface = pxeInterface;
      }
    }

    // if slaveInterfaceName is set - remove it from slaves, otherwise remove all
    if (slaveInterfaceName) {
      var slavesUpdated = _.reject(slaves, {name: slaveInterfaceName});
      var names = _.map(slavesUpdated, 'name');
      var bondSlaveInterfaces = this.props.interfaces.filter(
        (ifc) => _.contains(names, ifc.get('name'))
      );

      bond.set({
        slaves: slavesUpdated,
        offloading_modes: this.getIntersectedOffloadingModes(bondSlaveInterfaces)
      });
    } else {
      bond.set('slaves', []);
    }

    // destroy bond if all slave interfaces have been removed
    if (!slaveInterfaceName && targetInterface === bond) {
      targetInterface = this.props.interfaces.find({name: slaveInterfaceNames[0]});
    }

    // move networks if needed
    if (targetInterface !== bond) {
      var interfaceNetworks = bond.get('assigned_networks').remove(
        bond.get('assigned_networks').models
      );
      targetInterface.get('assigned_networks').add(interfaceNetworks);
    }

    // if no slaves left - remove the bond
    if (!bond.get('slaves').length) {
      this.props.interfaces.remove(bond);
    }
  },
  validate() {
    var {interfaces, cluster} = this.props;
    if (!interfaces) return;

    var interfacesErrors = {};
    var networkConfiguration = cluster.get('networkConfiguration');
    var networkingParameters = networkConfiguration.get('networking_parameters');
    var networks = networkConfiguration.get('networks');
    var slaveInterfaceNames = _.map(_.flatten(_.filter(interfaces.map('slaves'))), 'name');

    interfaces.each((ifc) => {
      if (!_.contains(slaveInterfaceNames, ifc.get('name'))) {
        var errors = ifc.validate({
          networkingParameters: networkingParameters,
          networks: networks
        }, {cluster});
        if (!_.isEmpty(errors)) interfacesErrors[ifc.get('name')] = errors;
      }
    });

    if (!_.isEqual(this.state.interfacesErrors, interfacesErrors)) {
      this.setState({interfacesErrors});
    }
  },
  validateSpeedsForBonding(interfaces) {
    var slaveInterfaces = _.flatten(_.invoke(interfaces, 'getSlaveInterfaces'), true);
    var speeds = _.invoke(slaveInterfaces, 'get', 'current_speed');
    // warn if not all speeds are the same or there are interfaces with unknown speed
    return _.uniq(speeds).length > 1 || !_.compact(speeds).length;
  },
  isSavingPossible() {
    return !_.chain(this.state.interfacesErrors).values().some().value() &&
      !this.state.actionInProgress && this.hasChanges();
  },
  getInterfaceProperty(property) {
    var {interfaces, nodes} = this.props;
    var bondsCount = interfaces.filter((ifc) => ifc.isBond()).length;
    var getPropertyValues = (ifcIndex) => {
      return _.uniq(nodes.map((node) => {
        var nodeBondsCount = node.interfaces.filter((ifc) => ifc.isBond()).length;
        var nodeInterface = node.interfaces.at(ifcIndex + nodeBondsCount);
        if (property === 'current_speed') return utils.showBandwidth(nodeInterface.get(property));
        return nodeInterface.get(property);
      }));
    };
    return interfaces.map((ifc, index) => {
      if (ifc.isBond()) {
        return _.map(ifc.get('slaves'),
          (slave) => getPropertyValues(interfaces.indexOf(interfaces.find(slave)) - bondsCount)
        );
      }
      return [getPropertyValues(index - bondsCount)];
    });
  },
  getAvailableBondingTypesForInterfaces(interfaces) {
    return _.intersection(... _.map(interfaces, this.getAvailableBondingTypes));
  },
  render() {
    var {nodes, interfaces} = this.props;
    var {interfacesByIndex, indexByInterface} = this.state;
    var nodeNames = nodes.map('name');
    var locked = this.isLocked();
    var configurationTemplateExists = this.configurationTemplateExists();

    var checkedInterfaces = interfaces.filter((ifc) => ifc.get('checked') && !ifc.isBond());
    var checkedBonds = interfaces.filter((ifc) => ifc.get('checked') && ifc.isBond());

    var creatingNewBond = checkedInterfaces.length >= 2 && !checkedBonds.length;
    var addingInterfacesToExistingBond = !!checkedInterfaces.length && checkedBonds.length === 1;

    // Available bonding types for interfaces slice across the nodes
    var availableBondingTypes = {};
    var nodesInterfaces = interfaces.map((ifc) => {
      var interfacesSlice = ifc.isBond() ?
        _.map(
          ifc.getSlaveInterfaces(),
          (slave) => interfacesByIndex[indexByInterface[slave.id]]
        )
      :
        interfacesByIndex[indexByInterface[ifc.id]];

      var bondingTypesSlice = ifc.isBond() ?
        _.flatten(_.union([ifc], interfacesSlice.map(_.rest)))
      :
        interfacesSlice;
      availableBondingTypes[ifc.get('name')] =
          this.getAvailableBondingTypesForInterfaces(bondingTypesSlice);

      return _.flatten(interfacesSlice);
    });

    var bondType = _.intersection(... _.compact(_.map(availableBondingTypes,
      (types, ifcName) => {
        var ifc = interfaces.find({name: ifcName});
        return ifc && ifc.get('checked') ? types : null;
      }
    )))[0];
    var bondingPossible = (creatingNewBond || addingInterfacesToExistingBond) && !!bondType;

    var unbondingPossible = !checkedInterfaces.length && !!checkedBonds.length;

    var hasChanges = this.hasChanges();
    var slaveInterfaceNames = _.map(_.flatten(_.filter(interfaces.map('slaves'))), 'name');
    var loadDefaultsEnabled = !this.state.actionInProgress;
    var revertChangesEnabled = !this.state.actionInProgress && hasChanges;

    var invalidSpeedsForBonding = bondingPossible &&
      this.validateSpeedsForBonding(checkedBonds.concat(checkedInterfaces)) ||
      interfaces.any((ifc) => ifc.isBond() && this.validateSpeedsForBonding([ifc]));

    var interfaceSpeeds = this.getInterfaceProperty('current_speed');
    var interfaceNames = this.getInterfaceProperty('name');

    return (
      <div className='row'>
        <div className='title'>
          {i18n(ns + (locked ? 'read_only_' : '') + 'title',
            {count: nodes.length, name: nodeNames.join(', ')})}
        </div>
        {configurationTemplateExists &&
          <div className='col-xs-12'>
            <div className='alert alert-warning'>
              {i18n(ns + 'configuration_template_warning')}
            </div>
          </div>
        }
        {_.any(availableBondingTypes, (bondingTypes) => bondingTypes.length) &&
          !configurationTemplateExists &&
          !locked &&
          <div className='col-xs-12'>
            <div className='page-buttons'>
              <div className='well clearfix'>
                <div className='btn-group pull-right'>
                  <button
                    className='btn btn-default btn-bond'
                    onClick={() => this.bondInterfaces(bondType)}
                    disabled={!bondingPossible}
                  >
                    {i18n(ns + 'bond_button')}
                  </button>
                  <button
                    className='btn btn-default btn-unbond'
                    onClick={this.unbondInterfaces}
                    disabled={!unbondingPossible}
                  >
                    {i18n(ns + 'unbond_button')}
                  </button>
                </div>
              </div>
            </div>
            {!bondingPossible && checkedInterfaces.concat(checkedBonds).length > 1 &&
              <div className='alert alert-warning'>
                {i18n(ns + (
                  checkedBonds.length > 1 ? 'several_bonds_warning' : 'interfaces_cannot_be_bonded'
                ))}
              </div>
            }
            {invalidSpeedsForBonding &&
              <div className='alert alert-warning'>{i18n(ns + 'bond_speed_warning')}</div>
            }
          </div>
        }
        <div className='ifc-list col-xs-12'>
          {interfaces.map((ifc, index) => {
            var ifcName = ifc.get('name');
            var limitations = this.state.limitations[ifc.isBond() ? ifcName : ifc.id];

            if (!_.contains(slaveInterfaceNames, ifcName)) {
              return (
                <NodeInterfaceDropTarget
                  {...this.props}
                  key={'interface-' + ifcName}
                  interface={ifc}
                  limitations={limitations}
                  nodesInterfaces={nodesInterfaces[index]}
                  hasChanges={
                    !_.isEqual(
                       _.findWhere(this.state.initialInterfaces, {name: ifcName}),
                      _.omit(ifc.toJSON(), 'state')
                    )
                  }
                  locked={locked}
                  configurationTemplateExists={configurationTemplateExists}
                  errors={this.state.interfacesErrors[ifcName]}
                  validate={this.validate}
                  removeInterfaceFromBond={this.removeInterfaceFromBond}
                  bondingProperties={this.props.bondingConfig.properties}
                  availableBondingTypes={availableBondingTypes[ifcName]}
                  getAvailableBondingTypes={this.getAvailableBondingTypes}
                  interfaceSpeeds={interfaceSpeeds[index]}
                  interfaceNames={interfaceNames[index]}
                />
              );
            }
          })}
        </div>
        <div className='col-xs-12 page-buttons content-elements'>
          <div className='well clearfix'>
            <div className='btn-group'>
              <a
                className='btn btn-default'
                href={'#cluster/' + this.props.cluster.id + '/nodes'}
                disabled={this.state.actionInProgress}
              >
                {i18n('cluster_page.nodes_tab.back_to_nodes_button')}
              </a>
            </div>
            {!locked &&
              <div className='btn-group pull-right'>
                <button
                  className='btn btn-default btn-defaults'
                  onClick={this.loadDefaults}
                  disabled={!loadDefaultsEnabled}
                >
                  {i18n('common.load_defaults_button')}
                </button>
                <button
                  className='btn btn-default btn-revert-changes'
                  onClick={this.revertChanges}
                  disabled={!revertChangesEnabled}
                >
                  {i18n('common.cancel_changes_button')}
                </button>
                <button
                  className='btn btn-success btn-apply'
                  onClick={this.applyChanges}
                  disabled={!this.isSavingPossible()}
                >
                  {i18n('common.apply_button')}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    );
  }
});

var NodeInterface = React.createClass({
  statics: {
    target: {
      drop(props, monitor) {
        var targetInterface = props.interface;
        var sourceInterface = props.interfaces.findWhere({name: monitor.getItem().interfaceName});
        var network = sourceInterface.get('assigned_networks')
          .findWhere({name: monitor.getItem().networkName});
        sourceInterface.get('assigned_networks').remove(network);
        targetInterface.get('assigned_networks').add(network);
        // trigger 'change' event to update screen buttons state
        targetInterface.trigger('change', targetInterface);
      },
      canDrop(props, monitor) {
        return monitor.getItem().interfaceName !== props.interface.get('name');
      }
    },
    collect(connect, monitor) {
      return {
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop()
      };
    }
  },
  mixins: [
    backboneMixin('interface'),
    backboneMixin({
      modelOrCollection(props) {
        return props.interface.get('assigned_networks');
      }
    })
  ],
  getRenderableIfcProperties() {
    var properties = ['offloading_modes', 'mtu', 'sriov'];
    if (_.contains(app.version.get('feature_groups'), 'experimental')) {
      properties.push('dpdk');
    }
    return properties;
  },
  getInitialState() {
    return {
      activeInterfaceSectionName: null,
      pendingToggle: false,
      collapsed: true
    };
  },
  isLacpRateAvailable() {
    return _.contains(this.getBondPropertyValues('lacp_rate', 'for_modes'), this.getBondMode());
  },
  isHashPolicyNeeded() {
    return _.contains(this.getBondPropertyValues('xmit_hash_policy', 'for_modes'),
      this.getBondMode());
  },
  getBondMode() {
    var ifc = this.props.interface;
    return ifc.get('mode') || (ifc.get('bond_properties') || {}).mode;
  },
  getAvailableBondingModes() {
    var {configModels, bondingProperties} = this.props;
    var ifc = this.props.interface;
    var bondType = ifc.get('bond_properties').type__;
    var modes = bondingProperties[bondType].mode;

    var availableModes = [];
    var interfaces = ifc.isBond() ? ifc.getSlaveInterfaces() : [ifc];
    _.each(interfaces, (ifc) => {
      availableModes.push(_.reduce(modes, (result, modeSet) => {
        if (
          modeSet.condition &&
        !(new Expression(modeSet.condition, configModels, {strict: false}))
          .evaluate({interface: ifc})
        ) {
          return result;
        }
        return result.concat(modeSet.values);
      }, []));
    });
    return _.intersection(...availableModes);
  },
  getBondPropertyValues(propertyName, value) {
    var bondType = this.props.interface.get('bond_properties').type__;
    return _.flatten(_.map(this.props.bondingProperties[bondType][propertyName], value));
  },
  updateBondProperties(options) {
    var bondProperties = _.cloneDeep(this.props.interface.get('bond_properties')) || {};
    bondProperties = _.extend(bondProperties, options);
    if (!this.isHashPolicyNeeded()) bondProperties = _.omit(bondProperties, 'xmit_hash_policy');
    if (!this.isLacpRateAvailable()) bondProperties = _.omit(bondProperties, 'lacp_rate');
    this.props.interface.set('bond_properties', bondProperties);
  },
  bondingChanged(name, value) {
    this.props.interface.set({checked: value});
  },
  bondingModeChanged(name, value) {
    this.props.interface.set({mode: value});
    this.updateBondProperties({mode: value});
    if (this.isHashPolicyNeeded()) {
      this.updateBondProperties({xmit_hash_policy: this.getBondPropertyValues('xmit_hash_policy',
        'values')[0]});
    }
    if (this.isLacpRateAvailable()) {
      this.updateBondProperties({lacp_rate: this.getBondPropertyValues('lacp_rate', 'values')[0]});
    }
  },
  onPolicyChange(name, value) {
    this.updateBondProperties({xmit_hash_policy: value});
  },
  onLacpChange(name, value) {
    this.updateBondProperties({lacp_rate: value});
  },
  getBondingOptions(bondingModes, attributeName) {
    return _.map(bondingModes, (mode) => {
      return (
        <option key={'option-' + mode} value={mode}>
          {i18n(ns + attributeName + '.' + mode.replace('.', '_'), {defaultValue: mode})}
        </option>
      );
    });
  },
  toggleOffloading() {
    var interfaceProperties = this.props.interface.get('interface_properties');
    var name = 'disable_offloading';
    this.onInterfacePropertiesChange(name, !interfaceProperties[name]);
  },
  makeOffloadingModesExcerpt() {
    var states = {
      true: i18n('common.enabled'),
      false: i18n('common.disabled'),
      null: i18n('cluster_page.nodes_tab.configure_interfaces.offloading_default')
    };
    var ifcModes = this.props.interface.get('offloading_modes');

    if (!ifcModes.length) {
      return states[!this.props.interface.get('interface_properties').disable_offloading];
    }
    if (_.uniq(_.map(ifcModes, 'state')).length === 1) {
      return states[ifcModes[0].state];
    }

    var lastState;
    var added = 0;
    var excerpt = [];
    _.each(ifcModes,
      (mode) => {
        if (!_.isNull(mode.state) && mode.state !== lastState) {
          lastState = mode.state;
          added++;
          excerpt.push((added > 1 ? ',' : '') + mode.name + ' ' + states[mode.state]);
        }
        // show no more than two modes in the button
        if (added === 2) return false;
      }
    );
    if (added < ifcModes.length) excerpt.push(', ...');
    return excerpt;
  },
  onInterfacePropertiesChange(name, value) {
    function convertToNullIfNaN(value) {
      var convertedValue = parseInt(value, 10);
      return _.isNaN(convertedValue) ? null : convertedValue;
    }
    if (_.contains(['mtu', 'sriov.sriov_numvfs'], name)) {
      value = convertToNullIfNaN(value);
    }
    var interfaceProperties = _.cloneDeep(this.props.interface.get('interface_properties') || {});
    _.set(interfaceProperties, name, value);
    this.props.interface.set('interface_properties', interfaceProperties);
  },
  renderLockTooltip(property) {
    return <Tooltip key={property + '-unavailable'} text={i18n(ns + 'availability_tooltip')}>
      <span className='glyphicon glyphicon-lock' aria-hidden='true'></span>
    </Tooltip>;
  },
  renderConfigurableAttributes() {
    var ifc = this.props.interface;
    var limitations = this.props.limitations;
    var ifcProperties = ifc.get('interface_properties');
    var errors = (this.props.errors || {}).interface_properties;
    var offloadingModes = ifc.get('offloading_modes') || [];
    var {collapsed, activeInterfaceSectionName} = this.state;
    var offloadingRestricted = !limitations.offloading_modes.equal;
    var renderableIfcProperties = this.getRenderableIfcProperties();
    var offloadingTabClasses = {
      forbidden: offloadingRestricted,
      'property-item-container': true,
      active: !collapsed && activeInterfaceSectionName === renderableIfcProperties[0]
    };
    return (
      <div className='properties-list'>
        <span className={utils.classNames(offloadingTabClasses)}>
          {offloadingRestricted && this.renderLockTooltip('offloading')}
          {i18n(ns + 'offloading_modes') + ':'}
          <button
            className='btn btn-link property-item'
            onClick={() => this.switchActiveSubtab(renderableIfcProperties[0])}
            disabled={offloadingRestricted}
          >
              {offloadingRestricted ?
                i18n(ns + 'different_availability')
              :
                offloadingModes.length ?
                  this.makeOffloadingModesExcerpt()
                :
                  ifcProperties.disable_offloading ?
                    i18n(ns + 'disable_offloading')
                  :
                    i18n(ns + 'default_offloading')
            }
          </button>
        </span>
        {_.map(ifcProperties, (propertyValue, propertyName) => {
          var {equal, shown} = _.get(
            limitations, propertyName,
            {equal: true, shown: true}
          );
          var propertyShown = !equal || shown;

          if (_.isPlainObject(propertyValue) && !propertyShown) return null;

          if (_.contains(renderableIfcProperties, propertyName)) {
            var classes = {
              'text-danger': _.has(errors, propertyName),
              'property-item-container': true,
              [propertyName]: true,
              active: !collapsed && activeInterfaceSectionName === propertyName,
              forbidden: !equal
            };
            var commonButtonProps = {
              className: 'btn btn-link property-item',
              onClick: () => this.switchActiveSubtab(propertyName)
            };
            //@TODO (morale): create some common component out of this
            switch (propertyName) {
              case 'sriov':
              case 'dpdk':
                return (
                  <span key={propertyName} className={utils.classNames(classes)}>
                    {!equal && this.renderLockTooltip(propertyName)}
                    {i18n(ns + propertyName) + ':'}
                    <button {...commonButtonProps} disabled={!equal}>
                      {equal ?
                        propertyValue.enabled ?
                          i18n('common.enabled')
                        :
                          i18n('common.disabled')
                       :
                       i18n(ns + 'different_availability')

                      }
                    </button>
                  </span>
                );
              default:
                return (
                  <span key={propertyName} className={utils.classNames(classes)}>
                    {!equal && this.renderLockTooltip(propertyName)}
                    {i18n(ns + propertyName) + ':'}
                    <button {...commonButtonProps} disabled={!equal}>
                      {propertyValue || i18n(ns + propertyName + '_placeholder')}
                    </button>
                  </span>
                );
            }
          }
        })}
      </div>
    );
  },
  getInterfacePropertyError() {
    return ((this.props.errors ||
      {}).interface_properties || {})[this.state.activeInterfaceSectionName] || null;
  },
  renderInterfaceSubtab() {
    var ifc = this.props.interface;
    var offloadingModes = ifc.get('offloading_modes') || [];
    var {locked} = this.props;
    var ifcProperties = ifc.get('interface_properties') || null;
    var errors = this.getInterfacePropertyError();
    switch (this.state.activeInterfaceSectionName) {
      case 'offloading_modes':
        return (
          <div>
            {offloadingModes.length ?
              <OffloadingModes interface={ifc} disabled={locked} />
            :
              <Input
                type='checkbox'
                label={i18n(ns + 'disable_offloading')}
                checked={!!ifcProperties.disable_offloading}
                name='disable_offloading'
                onChange={this.toggleOffloading}
                disabled={locked}
                wrapperClassName='toggle-offloading'
              />
            }
          </div>
        );
      case 'mtu':
        return (
          <Input
            type='number'
            min={42}
            max={65536}
            label={i18n(ns + 'mtu')}
            value={ifcProperties.mtu || ''}
            placeholder={i18n(ns + 'mtu_placeholder')}
            name='mtu'
            onChange={this.onInterfacePropertiesChange}
            disabled={locked}
            wrapperClassName='pull-left mtu-control'
            error={errors}
          />
        );
      case 'sriov':
        return this.renderSRIOV(errors);
      case 'dpdk':
        return this.renderDPDK(errors);
    }
  },
  changeBondType(newType) {
    this.props.interface.set('bond_properties.type__', newType);
    var newMode = _.flatten(
      _.map(this.props.bondingProperties[newType].mode, 'values')
    )[0];
    this.bondingModeChanged(null, newMode);
  },
  renderDPDK(errors) {
    var {nodesInterfaces} = this.props;
    var currentInterface = this.props.interface;
    var isBond = currentInterface.isBond();
    var currentDPDKValue = currentInterface.get('interface_properties').dpdk.enabled;
    var newBondType = isBond ?
      _.first(
        _.without(
          _.intersection(...
            // Gathering all available bonding types from all nodes interfaces
            _.map(nodesInterfaces, (ifc) => {
              ifc.get('interface_properties').dpdk.enabled = !currentDPDKValue;
              var bondTypes = this.props.getAvailableBondingTypes(ifc);
              ifc.get('interface_properties').dpdk.enabled = currentDPDKValue;
              return bondTypes;
            })
          // excluding the current one
          ), currentInterface.get('bond_properties').type__)
        )
      :
        null;

    return (
      <div className='dpdk-panel'>
        <div className='description'>{i18n(ns + 'dpdk_description')}</div>
        <Input
          type='checkbox'
          label={i18n('common.enabled')}
          checked={!!currentDPDKValue}
          name='dpdk.enabled'
          onChange={(propertyName, propertyValue) => {
            this.onInterfacePropertiesChange('dpdk.enabled', propertyValue);
            if (isBond) this.changeBondType(newBondType);
          }}
          disabled={this.props.locked || isBond && !newBondType}
          tooltipText={isBond && !newBondType && i18n(ns + 'locked_dpdk_bond')}
          wrapperClassName='dpdk-control'
          error={errors && errors.common}
        />
      </div>
    );
  },
  renderSRIOV(errors) {
    var ifc = this.props.interface;
    var interfaceProperties = ifc.get('interface_properties');
    var isSRIOVEnabled = interfaceProperties.sriov.enabled;
    var physnet = interfaceProperties.sriov.physnet;
    return (
      <div className='sriov-panel'>
        <div className='description'>{i18n(ns + 'sriov_description')}</div>
        <Input
          type='checkbox'
          label={i18n('common.enabled')}
          checked={!!isSRIOVEnabled}
          name='sriov.enabled'
          onChange={this.onInterfacePropertiesChange}
          disabled={this.props.locked}
          wrapperClassName='sriov-control'
          error={errors && errors.common}
        />
        {isSRIOVEnabled &&
          [
            <Input
              key='sriov.sriov_numvfs'
              type='number'
              min={0}
              max={interfaceProperties.sriov.sriov_totalvfs}
              label={i18n(ns + 'virtual_functions')}
              value={interfaceProperties.sriov.sriov_numvfs}
              name='sriov.sriov_numvfs'
              onChange={this.onInterfacePropertiesChange}
              disabled={this.props.locked}
              wrapperClassName='sriov-virtual-functions'
              error={errors && errors.sriov_numvfs}
            />,
            <Input
              key='sriov.physnet'
              type='text'
              label={i18n(ns + 'physical_network')}
              value={physnet}
              name='sriov.physnet'
              onChange={this.onInterfacePropertiesChange}
              disabled={this.props.locked}
              wrapperClassName='physnet'
              error={errors && errors.physnet}
              tooltipText={_.trim(physnet) && _.trim(physnet) !== 'physnet2' &&
                i18n(ns + 'validation.non_default_physnet')
              }
            />
          ]
        }
      </div>
    );
  },
  componentDidMount() {
    $(ReactDOM.findDOMNode(this.refs.properties))
      .on('show.bs.collapse', () => this.setState({pendingToggle: false, collapsed: false}))
      .on('hide.bs.collapse', () => this.setState({pendingToggle: false, collapsed: true}));
  },
  componentDidUpdate() {
    this.props.validate();
    if (this.state.pendingToggle) {
      $(ReactDOM.findDOMNode(this.refs.properties)).collapse('toggle');
    }
  },
  switchActiveSubtab(subTabName) {
    var currentActiveTab = this.state.activeInterfaceSectionName;
    this.setState({
      pendingToggle: !currentActiveTab || currentActiveTab === subTabName || this.state.collapsed,
      activeInterfaceSectionName: subTabName
    });
  },
  renderInterfaceProperties() {
    if (!this.props.interface.get('interface_properties')) return null;
    var isConfigurationModeOn = !_.isNull(this.state.activeInterfaceSectionName);
    var toggleConfigurationPanelClasses = utils.classNames({
      'glyphicon glyphicon-menu-down': true,
      rotate: !this.state.collapsed
    });
    var renderableIfcProperties = this.getRenderableIfcProperties();
    var defaultSubtab = _.find(renderableIfcProperties, (ifcProperty) => {
      var limitation = _.get(this.props.limitations, ifcProperty);
      return limitation && limitation.equal && !!limitation.shown;
    });
    return (
      <div className='ifc-properties clearfix forms-box'>
        <div className='row'>
          <div className='col-xs-11'>
            {this.renderConfigurableAttributes()}
          </div>
          <div className='col-xs-1 toggle-configuration-control'>
            <i
              className={toggleConfigurationPanelClasses}
              onClick={() => this.switchActiveSubtab(
                isConfigurationModeOn ?
                  this.state.activeInterfaceSectionName :
                  defaultSubtab
              )}
            />
          </div>
        </div>
        <div className='row configuration-panel collapse' ref='properties'>
          <div className='col-xs-12 forms-box interface-sub-tab'>
            {this.renderInterfaceSubtab()}
          </div>
        </div>
      </div>
    );
  },
  render() {
    var ifc = this.props.interface;
    var {cluster, locked, availableBondingTypes, configurationTemplateExists} = this.props;
    var isBond = ifc.isBond();
    var availableBondingModes = isBond ? this.getAvailableBondingModes() : [];
    var networkConfiguration = cluster.get('networkConfiguration');
    var networks = networkConfiguration.get('networks');
    var networkingParameters = networkConfiguration.get('networking_parameters');
    var slaveInterfaces = ifc.getSlaveInterfaces();
    var assignedNetworks = ifc.get('assigned_networks');
    var connectionStatusClasses = (slave) => {
      var slaveDown = slave.get('state') === 'down';
      return {
        'ifc-connection-status': true,
        'ifc-online': !slaveDown,
        'ifc-offline': slaveDown
      };
    };
    var bondProperties = ifc.get('bond_properties');
    var bondingPossible = !!availableBondingTypes.length && !configurationTemplateExists && !locked;
    var networkErrors = (this.props.errors || {}).network_errors;
    return this.props.connectDropTarget(
      <div className='ifc-container'>
        <div
          className={utils.classNames({
            'ifc-inner-container': true,
            nodrag: networkErrors,
            over: this.props.isOver && this.props.canDrop,
            'has-changes': this.props.hasChanges,
            [ifc.get('name')]: true
          })}
        >
          <div className='ifc-header clearfix forms-box'>
            <div className={utils.classNames({
              'common-ifc-name pull-left': true,
              'no-checkbox': !bondingPossible
            })}>
              {bondingPossible ?
                <Input
                  type='checkbox'
                  label={ifc.get('name')}
                  onChange={this.bondingChanged}
                  checked={!!ifc.get('checked')}
                />
              :
                ifc.get('name')
              }
            </div>
            {isBond && [
              <Input
                key='bonding_mode'
                type='select'
                disabled={!bondingPossible}
                onChange={this.bondingModeChanged}
                value={this.getBondMode()}
                label={i18n(ns + 'bonding_mode')}
                children={this.getBondingOptions(availableBondingModes, 'bonding_modes')}
                wrapperClassName='pull-right'
              />,
              this.isHashPolicyNeeded() &&
                <Input
                  key='bonding_policy'
                  type='select'
                  value={bondProperties.xmit_hash_policy}
                  disabled={!bondingPossible}
                  onChange={this.onPolicyChange}
                  label={i18n(ns + 'bonding_policy')}
                  children={this.getBondingOptions(
                    this.getBondPropertyValues('xmit_hash_policy', 'values'),
                    'hash_policy'
                  )}
                  wrapperClassName='pull-right'
                />,
              this.isLacpRateAvailable() &&
                <Input
                  key='lacp_rate'
                  type='select'
                  value={bondProperties.lacp_rate}
                  disabled={!bondingPossible}
                  onChange={this.onLacpChange}
                  label={i18n(ns + 'lacp_rate')}
                  children={this.getBondingOptions(
                    this.getBondPropertyValues('lacp_rate', 'values'),
                    'lacp_rates'
                  )}
                  wrapperClassName='pull-right'
                />
            ]}
          </div>
          <div className='networks-block'>
            <div className='row'>
              <div className='col-xs-3'>
                <div className='pull-left'>
                  {_.map(slaveInterfaces, (slaveInterface, index) => {
                    return (
                      <div
                        key={'info-' + slaveInterface.get('name')}
                        className='ifc-info-block clearfix'
                        >
                        <div className='ifc-connection pull-left'>
                          <div
                            className={utils.classNames(connectionStatusClasses(slaveInterface))}
                          />
                        </div>
                        <div className='ifc-info pull-left'>
                          {isBond &&
                            <div>
                              {i18n(ns + 'name')}:
                              {' '}
                              <span className='ifc-name'>{this.props.interfaceNames[index]}</span>
                            </div>
                          }
                          {this.props.nodes.length === 1 &&
                            <div>{i18n(ns + 'mac')}: {slaveInterface.get('mac')}</div>
                          }
                          <div>
                            {i18n(ns + 'speed')}: {this.props.interfaceSpeeds[index].join(', ')}
                          </div>
                          {(bondingPossible && slaveInterfaces.length >= 3) &&
                            <button
                              className='btn btn-link'
                              onClick={_.partial(
                                    this.props.removeInterfaceFromBond,
                                    ifc.get('name'), slaveInterface.get('name')
                                  )}
                              >
                              {i18n('common.remove_button')}
                            </button>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className='col-xs-9'>
                {!configurationTemplateExists &&
                  <div className='ifc-networks'>
                    {assignedNetworks.length ?
                      assignedNetworks.map((interfaceNetwork) => {
                        var network = interfaceNetwork.getFullNetwork(networks);
                        if (!network) return null;
                        return (
                          <DraggableNetwork
                            key={'network-' + network.id}
                            {... _.pick(this.props, ['locked', 'interface'])}
                            networkingParameters={networkingParameters}
                            interfaceNetwork={interfaceNetwork}
                            network={network}
                          />
                        );
                      })
                    :
                      i18n(ns + 'drag_and_drop_description')
                    }
                  </div>
                }
              </div>
            </div>
            {networkErrors && !!networkErrors.length &&
              <div className='ifc-error alert alert-danger'>
                {networkErrors.join(', ')}
              </div>
            }
          </div>
          {this.renderInterfaceProperties()}
        </div>
      </div>
    );
  }
});

var NodeInterfaceDropTarget = DropTarget(
  'network',
  NodeInterface.target,
  NodeInterface.collect
)(NodeInterface);

var Network = React.createClass({
  statics: {
    source: {
      beginDrag(props) {
        return {
          networkName: props.network.get('name'),
          interfaceName: props.interface.get('name')
        };
      },
      canDrag(props) {
        return !(props.locked || props.network.get('meta').unmovable);
      }
    },
    collect(connect, monitor) {
      return {
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging()
      };
    }
  },
  render() {
    var network = this.props.network;
    var interfaceNetwork = this.props.interfaceNetwork;
    var networkingParameters = this.props.networkingParameters;
    var classes = {
      'network-block pull-left': true,
      disabled: !this.constructor.source.canDrag(this.props),
      dragging: this.props.isDragging
    };
    var vlanRange = network.getVlanRange(networkingParameters);

    return this.props.connectDragSource(
      <div className={utils.classNames(classes)}>
        <div className='network-name'>
          {i18n(
            'network.' + interfaceNetwork.get('name'),
            {defaultValue: interfaceNetwork.get('name')}
          )}
        </div>
        {vlanRange &&
          <div className='vlan-id'>
            {i18n(ns + 'vlan_id', {count: _.uniq(vlanRange).length})}:
            {_.uniq(vlanRange).join('-')}
          </div>
        }
      </div>
    );
  }
});

var DraggableNetwork = DragSource('network', Network.source, Network.collect)(Network);

export default EditNodeInterfacesScreen;
