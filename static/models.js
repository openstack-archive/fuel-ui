/*
 * Copyright 2013 Mirantis, Inc.
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

import _ from 'underscore';
import i18n from 'i18n';
import Backbone from 'backbone';
import Cookies from 'js-cookie';
import Expression from 'expression';
import {ModelPath} from 'expression/objects';
import utils from 'utils';
import customControls from 'views/custom_controls';
import {Input} from 'views/controls';
import deepModelMixin from 'deep_model_mixin';
import {DEPLOYMENT_GRAPH_LEVELS} from 'consts';

var models = {};

var superMixin = models.superMixin = {
  _super(method, args) {
    var object = this;
    while (object[method] === this[method]) object = object.constructor.__super__;
    return object[method].apply(this, args || []);
  }
};

// Mixin for adjusting some collection functions to work properly with model.get.
// Lodash supports some methods with predicate objects, not functions.
// Underscore has only pure predicate functions.
// We need to convert predicate objects to functions that use model's
// get functionality -- otherwise model.property always returns undefined.

var collectionMixin = {
  getByIds(ids) {
    return this.filter((model) => _.includes(ids, model.id));
  }
};

var collectionMethods = [
  'dropRightWhile', 'dropWhile', 'takeRightWhile', 'takeWhile',
  'findIndex', 'findLastIndex',
  'findKey', 'findLastKey',
  'find', 'findLast',
  'filter', 'reject',
  'every', 'some', 'invokeMap',
  'partition'
];

_.each(collectionMethods, (method) => {
  collectionMixin[method] = function() {
    var args = _.toArray(arguments);
    var source = args[0];

    if (_.isPlainObject(source)) {
      args[0] = (model) => _.isMatch(model.attributes, source);
    }
    args.unshift(this.models);
    return _[method](...args);
  };
});

var fetchOptionsMixin = {
  initialize({fetchOptions} = {fetchOptions: {}}) {
    this._super('initialize', arguments);
    this.updateFetchOptions(fetchOptions);
  },
  updateFetchOptions(fetchOptions) {
    this.fetchOptions = fetchOptions;
  },
  fetch(options) {
    var fetchOptions = _.result(this, 'fetchOptions', {});
    return Backbone.Collection.prototype.fetch.call(
      this, !_.isEmpty(fetchOptions) ? _.extend({data: fetchOptions}, options) : options
    );
  }
};

var BaseModel = models.BaseModel = Backbone.Model.extend(superMixin);
var BaseCollection = models.BaseCollection =
  Backbone.Collection.extend(collectionMixin).extend(superMixin).extend(fetchOptionsMixin);

var cacheMixin = {
  fetch(options) {
    if (this.cacheFor && options && options.cache && this.lastSyncTime &&
      (this.cacheFor > (new Date() - this.lastSyncTime))) {
      return Promise.resolve();
    }
    if (options) delete options.cache;
    return this._super('fetch', arguments);
  },
  sync() {
    var promise = this._super('sync', arguments);
    if (this.cacheFor) {
      promise.then(() => {
        this.lastSyncTime = new Date();
      });
    }
    return promise;
  },
  cancelThrottling() {
    delete this.lastSyncTime;
  }
};
models.cacheMixin = cacheMixin;

var restrictionMixin = models.restrictionMixin = {
  checkRestrictions(models, actions, setting) {
    var restrictions = _.map(
      setting ? setting.restrictions : this.get('restrictions'),
      utils.expandRestriction
    );

    if (!actions) {
      actions = [];
    } else if (_.isString(actions)) {
      actions = [actions];
    }
    if (actions.length) {
      restrictions = _.filter(restrictions,
        (restriction) => _.includes(actions, restriction.action)
      );
    }

    var satisfiedRestrictions = _.filter(restrictions,
        (restriction) => new Expression(restriction.condition, models, restriction).evaluate()
      );
    return {
      result: !!satisfiedRestrictions.length,
      message: _.compact(_.map(satisfiedRestrictions, 'message')).join(' ')
    };
  },
  expandLimits(limits) {
    this.expandedLimits = this.expandedLimits || {};
    this.expandedLimits[this.get('name')] = limits;
  },
  checkLimits(models, nodes, checkLimitIsReached = true, limitTypes = ['min', 'max']) {
    /*
     *  Check the 'limits' section of configuration.
     *  models -- current models to check the limits
     *  nodes -- node collection to check the limits
     *  checkLimitIsReached -- boolean (default: true), if true then for min = 1, 1 node is allowed
     *      if false, then for min = 1, 1 node is not allowed anymore
     *      This is because validation runs in 2 modes: validate current model as is
     *      and validate current model checking the possibility of adding/removing node
     *      So if max = 1 and we have 1 node then:
     *        - the model is valid as is (return true) -- case for checkLimitIsReached = true
     *        - there can be no more nodes added (return false) -- case for
     *          checkLimitIsReached = false
     *  limitType -- array of limit types to check. Possible choices are 'min', 'max', 'recommended'
    **/

    var evaluateExpressionHelper = (expression, models) => {
      if (_.isUndefined(expression) || _.isNumber(expression)) return expression;

      var result = (new Expression(expression, models)).evaluate();
      if (result instanceof ModelPath) result = result.model.get(result.attribute);

      return result;
    };

    var checkedLimitTypes = {};
    var name = this.get('name');
    var limits = this.expandedLimits[name] || {};
    var overrides = limits.overrides || [];
    var limitValues = {
      max: evaluateExpressionHelper(limits.max, models),
      min: evaluateExpressionHelper(limits.min, models),
      recommended: evaluateExpressionHelper(limits.recommended, models)
    };
    var count = nodes.nodesAfterDeploymentWithRole(name).length;
    var messages;
    var label = this.get('label');

    var checkOneLimit = (obj, limitType) => {
      var limitValue, comparator;

      if (_.isUndefined(obj[limitType])) {
        return null;
      }
      switch (limitType) {
        case 'min':
          comparator = checkLimitIsReached ? (a, b) => a < b : (a, b) => a <= b;
          break;
        case 'max':
          comparator = checkLimitIsReached ? (a, b) => a > b : (a, b) => a >= b;
          break;
        default:
          comparator = (a, b) => a < b;
      }
      limitValue = parseInt(evaluateExpressionHelper(obj[limitType], models), 10);
      // Update limitValue with overrides, this way at the end we have a flattened
      // limitValues with overrides having priority
      limitValues[limitType] = limitValue;
      checkedLimitTypes[limitType] = true;
      if (comparator(count, limitValue)) {
        return {
          type: limitType,
          value: limitValue,
          message: obj.message || i18n('common.role_limits.' + limitType,
            {limitValue: limitValue, count: count, roleName: label})
        };
      }
    };

    // Check the overridden limit types
    messages = _.chain(overrides)
      .map((override) => {
        var exp = evaluateExpressionHelper(override.condition, models);

        if (exp) {
          return _.map(limitTypes, _.partial(checkOneLimit, override));
        }
      })
      .flatten()
      .compact()
      .value();
    // Now check the global, not-overridden limit types
    messages = messages.concat(_.chain(limitTypes)
      .map((limitType) => {
        if (checkedLimitTypes[limitType]) {
          return null;
        }
        return checkOneLimit(limitValues, limitType);
      })
      .flatten()
      .compact()
      .value()
    );
    // There can be multiple messages for same limit type
    // (for example, multiple 'min' messages) coming from
    // multiple override methods. We pick a single, worst
    // message, i.e. for 'min' and 'recommended' types we
    // pick one with maximal value, for 'max' type we pick
    // the minimal one.
    messages = _.map(limitTypes, (limitType) => {
      var message = _.chain(messages)
        .filter({type: limitType})
        .sortBy('value')
        .value();
      if (limitType !== 'max') {
        message = message.reverse();
      }
      if (message[0]) {
        return message[0].message;
      }
    });
    messages = _.compact(messages).join(' ');

    return {
      count: count,
      limits: limitValues,
      message: messages,
      valid: !messages
    };
  }
};

models.Plugin = BaseModel.extend({
  constructorName: 'Plugin',
  urlRoot: '/api/plugins'
});

models.Plugins = BaseCollection.extend({
  constructorName: 'Plugins',
  model: models.Plugin,
  url: '/api/plugins'
});

models.Role = BaseModel.extend(restrictionMixin).extend({
  idAttribute: 'name',
  constructorName: 'Role',
  parse(response) {
    _.extend(response, _.omit(response.meta, 'name'));
    response.label = response.meta.name;
    delete response.meta;
    return response;
  }
});

models.Roles = BaseCollection.extend(restrictionMixin).extend({
  constructorName: 'Roles',
  comparator: 'weight',
  model: models.Role,
  groups: ['base', 'compute', 'storage', 'other'],
  initialize() {
    this.processConflictsAndRestrictions();
    this.on('update', this.processConflictsAndRestrictions, this);
  },
  processConflictsAndRestrictions() {
    this.each((role) => {
      role.expandLimits(role.get('limits'));

      var roleConflicts = role.get('conflicts');
      var roleName = role.get('name');

      if (roleConflicts === '*') {
        role.conflicts = _.map(this.reject({name: roleName}), (role) => role.get('name'));
      } else {
        role.conflicts = _.chain(role.conflicts)
          .union(roleConflicts)
          .uniq()
          .compact()
          .value();
      }

      _.each(role.conflicts, (conflictRoleName) => {
        var conflictingRole = this.find({name: conflictRoleName});
        if (conflictingRole) {
          conflictingRole.conflicts = _.uniq(_.union(conflictingRole.conflicts || [], [roleName]));
        }
      });
    });
  }
});

models.Release = BaseModel.extend({
  constructorName: 'Release',
  urlRoot: '/api/releases'
});

models.ReleaseNetworkProperties = BaseModel.extend({
  constructorName: 'ReleaseNetworkProperties'
});

models.Releases = BaseCollection.extend(cacheMixin).extend({
  constructorName: 'Releases',
  cacheFor: 60 * 1000,
  model: models.Release,
  url: '/api/releases'
});

models.Cluster = BaseModel.extend({
  constructorName: 'Cluster',
  urlRoot: '/api/clusters',
  defaults() {
    var defaults = {
      nodes: new models.Nodes(),
      tasks: new models.Tasks(),
      nodeNetworkGroups: new models.NodeNetworkGroups(),
      transactions: new models.Transactions(),
      deploymentGraphs: new models.DeploymentGraphs()
    };
    _.each(defaults, (collection, key) => {
      collection.cluster = this;
      collection.updateFetchOptions(() => {
        var fetchOptions = {cluster_id: this.id};
        if (key === 'transactions') fetchOptions.transaction_types = 'deployment';
        return fetchOptions;
      });
    });
    return defaults;
  },
  validate(attrs) {
    var errors = {};
    if (!_.trim(attrs.name) || !_.trim(attrs.name).length) {
      errors.name = 'Environment name cannot be empty';
    }
    if (!attrs.release) {
      errors.release = 'Please choose OpenStack release';
    }
    return _.isEmpty(errors) ? null : errors;
  },
  task(filter1, filter2) {
    var filters = _.isPlainObject(filter1) ? filter1 : {name: filter1, status: filter2};
    return this.get('tasks') && this.get('tasks').findTask(filters);
  },
  tasks(filter1, filter2) {
    var filters = _.isPlainObject(filter1) ? filter1 : {name: filter1, status: filter2};
    return this.get('tasks') && this.get('tasks').filterTasks(filters);
  },
  needsRedeployment() {
    return this.get('nodes').some({pending_addition: false, status: 'error'}) &&
      this.get('status') !== 'update_error';
  },
  isAvailableForSettingsChanges() {
    return !this.get('is_locked');
  },
  isDeploymentPossible({configModels}) {
    return this.get('release').get('state') !== 'unavailable' &&
      !this.task({group: 'deployment', active: true}) && (
        this.get('status') !== 'operational' ||
        this.hasChanges({configModels}) ||
        this.needsRedeployment()
      );
  },
  isConfigurationChanged({configModels}) {
    var settings = this.get('settings');
    var deployedSettings = this.get('deployedSettings');
    var networkConfiguration = this.get('networkConfiguration');
    var deployedNetworkConfiguration = this.get('deployedNetworkConfiguration');

    if (
      this.get('status') === 'new' ||
      _.isEmpty(deployedSettings.attributes) ||
      _.isEmpty(deployedNetworkConfiguration.attributes)
    ) return false;

    if (settings.hasChanges(deployedSettings.attributes, configModels)) return true;

    if (
      !_.isEqual(
        networkConfiguration.get('networking_parameters').toJSON(),
        deployedNetworkConfiguration.get('networking_parameters').toJSON()
      )
    ) return true;

    return networkConfiguration.get('networks').some((network) => {
      var deployedNetwork = deployedNetworkConfiguration.get('networks').get(network.id);
      if (!deployedNetwork || !network.get('meta').configurable) return false;
      return _.some(network.getEditableAttributes(), (attribute) => {
        if (_.isArray(attribute)) {
          // check network metadata changes
          var networkMetadata = network.get('meta');
          var deployedNetworkMetadata = deployedNetwork.get('meta');
          return _.some(attribute,
            (metadata) => !_.isEqual(networkMetadata[metadata], deployedNetworkMetadata[metadata])
          );
        }
        return !_.isEqual(network.get(attribute), deployedNetwork.get(attribute));
      });
    });
  },
  hasChanges({configModels}) {
    return this.get('nodes').hasChanges() || this.isConfigurationChanged({configModels});
  },
  getAllocatedRoles() {
    return _.chain(this.get('nodes').filter({pending_deletion: false}))
      .map((node) => node.get('roles').concat(node.get('pending_roles')))
      .flatten()
      .uniq()
      .value();
  },
  isHealthCheckAvailable() {
    return _.includes(['operational', 'error'], this.get('status'));
  }
});

models.Clusters = BaseCollection.extend({
  constructorName: 'Clusters',
  model: models.Cluster,
  url: '/api/clusters',
  comparator: 'id'
});

models.Node = BaseModel.extend({
  constructorName: 'Node',
  urlRoot: '/api/nodes',
  resource(resourceName) {
    var resource = 0;
    try {
      if (resourceName === 'cores') {
        resource = this.get('meta').cpu.real;
      } else if (resourceName === 'ht_cores') {
        resource = this.get('meta').cpu.total;
      } else if (resourceName === 'hdd') {
        resource = _.reduce(this.get('meta').disks, (hdd, disk) => {
          return _.isNumber(disk.size) ? hdd + disk.size : hdd;
        }, 0);
      } else if (resourceName === 'ram') {
        resource = this.get('meta').memory.total;
      } else if (resourceName === 'disks') {
        resource = _.map(this.get('meta').disks, 'size').sort((a, b) => a - b);
      } else if (resourceName === 'disks_amount') {
        resource = this.get('meta').disks.length;
      } else if (resourceName === 'interfaces') {
        resource = this.get('meta').interfaces.length;
      }
    } catch (ignore) {}
    return _.isNaN(resource) ? 0 : resource;
  },
  sortedRoles(preferredOrder) {
    return _.union(this.get('roles'), this.get('pending_roles')).sort((a, b) => {
      return _.indexOf(preferredOrder, a) - _.indexOf(preferredOrder, b);
    });
  },
  isSelectable() {
    // forbid removing node from adding to environments
    // and useless management of roles, disks, interfaces, etc.
    return this.get('status') !== 'removing';
  },
  hasRole(roles = [], onlyDeployedRoles = false) {
    if (_.isString(roles)) roles = [roles];
    var nodeRoles = this.get('roles');
    if (!onlyDeployedRoles) nodeRoles = nodeRoles.concat(this.get('pending_roles'));
    return !!_.intersection(nodeRoles, roles).length;
  },
  isProvisioningPossible() {
    var status = this.get('status');
    return (
        status === 'discover' ||
        status === 'error' && this.get('error_type') === 'provision'
      ) &&
      // virt nodes should be provisioned with spawn_vms task
      !this.hasRole('virt');
  },
  isDeploymentPossible() {
    var status = this.get('status');
    return status === 'provisioned' ||
      status === 'stopped' ||
      status === 'error' && this.get('error_type') === 'deploy';
  },
  hasChanges() {
    return this.get('pending_addition') ||
      this.get('pending_deletion') ||
      this.get('status') === 'stopped' ||
      !!this.get('cluster') && !!this.get('pending_roles').length;
  },
  areDisksConfigurable() {
    var status = this.get('status');
    return status === 'discover' || status === 'error';
  },
  areInterfacesConfigurable() {
    var status = this.get('status');
    var error = this.get('error_type');
    // FIXME(jaranovich): #1592355 - interfaces of 'ready' node should be also configurable
    return status === 'discover' || status === 'stopped' ||
      status === 'error' && (error === 'discover' || error === 'deploy');
  },
  getRolesSummary(releaseRoles) {
    return _.map(this.sortedRoles(releaseRoles.map('name')),
      (role) => releaseRoles.find({name: role}).get('label')
    ).join(', ');
  },
  getStatus() {
    if (!this.get('online')) return 'offline';
    return this.get('status');
  },
  getLabel(label) {
    var labelValue = this.get('labels')[label];
    return _.isUndefined(labelValue) ? false : labelValue;
  }
});

models.Nodes = BaseCollection.extend({
  constructorName: 'Nodes',
  model: models.Node,
  url: '/api/nodes',
  comparator: 'id',
  hasChanges() {
    return _.some(this.invokeMap('hasChanges'));
  },
  nodesAfterDeployment() {
    return this.filter((node) => !node.get('pending_deletion'));
  },
  nodesAfterDeploymentWithRole(role) {
    return _.filter(this.nodesAfterDeployment(), (node) => node.hasRole(role));
  },
  resources(resourceName) {
    return _.reduce(this.invokeMap('resource', resourceName), (sum, n) => sum + n, 0);
  },
  getLabelValues(label) {
    return this.invokeMap('getLabel', label);
  },
  areDisksConfigurable() {
    if (!this.length) return false;
    var roles = _.union(this.at(0).get('roles'), this.at(0).get('pending_roles'));
    var disks = this.at(0).resource('disks');
    return !this.some((node) => {
      var roleConflict = _.difference(roles, _.union(node.get('roles'),
        node.get('pending_roles'))).length;
      return roleConflict || !_.isEqual(disks, node.resource('disks'));
    });
  },
  areInterfacesConfigurable() {
    if (!this.length) return false;
    return _.uniq(this.invokeMap('resource', 'interfaces')).length === 1;
  }
});

models.NodesStatistics = BaseModel.extend({
  constructorName: 'NodesStatistics',
  urlRoot: '/api/nodes/allocation/stats'
});

models.Task = BaseModel.extend({
  constructorName: 'Task',
  urlRoot: '/api/tasks',
  releaseId() {
    var id;
    try {
      id = this.get('result').release_info.release_id;
    } catch (ignore) {}
    return id;
  },
  groups: {
    network: [
      'verify_networks',
      'check_networks'
    ],
    deployment: [
      'stop_deployment',
      'deploy',
      'provision',
      'deployment',
      'reset_environment',
      'spawn_vms'
    ]
  },
  extendGroups(filters) {
    var names = utils.composeList(filters.name);
    if (_.isEmpty(names)) names = _.flatten(_.values(this.groups));
    var groups = utils.composeList(filters.group);
    if (_.isEmpty(groups)) return names;
    return _.intersection(names, _.flatten(_.values(_.pick(this.groups, groups))));
  },
  extendStatuses(filters) {
    var activeTaskStatuses = ['running', 'pending'];
    var completedTaskStatuses = ['ready', 'error'];
    var statuses = utils.composeList(filters.status);
    if (_.isEmpty(statuses)) {
      statuses = _.union(activeTaskStatuses, completedTaskStatuses);
    }
    if (_.isBoolean(filters.active)) {
      return _.intersection(statuses, filters.active ? activeTaskStatuses : completedTaskStatuses);
    }
    return statuses;
  },
  match(filters) {
    filters = filters || {};
    if (!_.isEmpty(filters)) {
      if ((filters.group || filters.name) &&
        !_.includes(this.extendGroups(filters), this.get('name'))) {
        return false;
      }
      if ((filters.status || _.isBoolean(filters.active)) &&
        !_.includes(this.extendStatuses(filters), this.get('status'))) {
        return false;
      }
    }
    return true;
  },
  isInfinite() {
    return this.match({name: ['stop_deployment', 'reset_environment']});
  },
  isStoppable() {
    return this.match({name: ['deploy', 'provision', 'deployment']});
  }
});

models.Tasks = BaseCollection.extend({
  constructorName: 'Tasks',
  model: models.Task,
  url: '/api/tasks',
  toJSON() {
    return this.map('id');
  },
  comparator: 'id',
  filterTasks(filters) {
    return _.chain(this.model.prototype.extendGroups(filters))
      .map((name) => {
        return this.filter((task) => task.match(_.extend(_.omit(filters, 'group'), {name: name})));
      })
      .flatten()
      .compact()
      .value();
  },
  findTask(filters) {
    return this.filterTasks(filters)[0];
  }
});

models.Transaction = models.Task.extend({
  constructorName: 'Transaction'
});

models.Transactions = models.Tasks.extend({
  constructorName: 'Transactions',
  model: models.Transaction,
  url: '/api/transactions'
});

models.DeploymentTask = BaseModel.extend({
  constructorName: 'DeploymentTask'
});

models.DeploymentTasks = BaseCollection.extend({
  constructorName: 'DeploymentTasks',
  model: models.DeploymentTask,
  comparator(task1, task2) {
    var node1 = task1.get('node_id');
    var node2 = task2.get('node_id');
    if (node1 === node2) return utils.compare(task1, task2, {attr: 'time_start'});
    // master node tasks should go first
    if (node1 === 'master') return -1;
    if (node2 === 'master') return 1;
    return node1 - node2;
  },
  parse(response) {
    // no need to show tasks of Virtual Sync Node (node_id is Null)
    // also no need to show tasks that were not executed on any node (node_id is '-')
    return _.filter(response, (task) => !_.isNull(task.node_id) && task.node_id !== '-');
  },
  fetch(options) {
    options = _.extend({}, options, {beforeSend: (xhr) => {
      xhr.then(() => {
        this.lastFetchDate = xhr.getResponseHeader('Date');
      });
    }});
    return this._super('fetch', [options]);
  }
});

models.DeploymentGraph = BaseModel.extend({
  constructorName: 'DeploymentGraph',
  urlRoot: 'api/graphs/',
  toJSON() {
    var attributes = this._super('toJSON', arguments);
    return _.omit(attributes, 'type');
  },
  getType() {
    // relations attribute has one element only for now
    return this.get('relations')[0].type;
  },
  getLevel() {
    return this.get('relations')[0].model;
  },
  validate(attrs, {usedTypes = []}) {
    var errors = {};
    if (!attrs.type || !attrs.type.match(/^[\w-]+$/)) {
      errors.type = i18n('dialog.upload_graph.invalid_type');
    } else if (_.includes(usedTypes, attrs.type)) {
      errors.type = i18n('dialog.upload_graph.existing_type');
    }
    return _.isEmpty(errors) ? null : errors;
  }
});

models.DeploymentGraphs = BaseCollection
  .extend(cacheMixin)
  .extend({
    url: '/api/graphs',
    constructorName: 'DeploymentGraphs',
    cacheFor: 60 * 1000,
    model: models.DeploymentGraph,
    comparator(graph1, graph2) {
      // sort graphs by type then by level
      var type1 = graph1.getType();
      var type2 = graph2.getType();
      if (type1 === type2) {
        var level1 = graph1.getLevel();
        var level2 = graph2.getLevel();
        if (level1 === level2) return graph1.id - graph2.id;
        return _.indexOf(DEPLOYMENT_GRAPH_LEVELS, level1) -
          _.indexOf(DEPLOYMENT_GRAPH_LEVELS, level2);
      }
      // graphs with type 'default' should go first
      if (type1 === 'default') return -1;
      if (type2 === 'default') return 1;
      return utils.natsort(type1, type2);
    }
  });

models.Notification = BaseModel.extend({
  constructorName: 'Notification',
  urlRoot: '/api/notifications'
});

models.Notifications = BaseCollection.extend({
  constructorName: 'Notifications',
  model: models.Notification,
  url: '/api/notifications',
  comparator(notification) {
    return -notification.id;
  }
});

models.Settings = BaseModel
  .extend(deepModelMixin)
  .extend(cacheMixin)
  .extend(restrictionMixin)
  .extend({
    constructorName: 'Settings',
    urlRoot: '/api/clusters/',
    root: 'editable',
    cacheFor: 60 * 1000,
    groupList: ['general', 'security', 'compute', 'network', 'storage',
      'logging', 'openstack_services', 'other'],
    isNew() {
      return false;
    },
    isPlugin(section) {
      return (section.metadata || {}).class === 'plugin';
    },
    parse(response) {
      return this.root ? response[this.root] : response;
    },
    mergePluginSettings(pluginNames) {
      if (!pluginNames) {
        pluginNames = _.compact(_.map(this.attributes,
          (section, sectionName) => this.isPlugin(section) && sectionName
        ));
      } else if (_.isString(pluginNames)) {
        pluginNames = [pluginNames];
      }

      var mergeSettings = (pluginName) => {
        var plugin = this.get(pluginName);
        var chosenVersionData = plugin.metadata.versions.find(
          (version) => version.metadata.plugin_id === plugin.metadata.chosen_id
        );
        // merge metadata of a chosen plugin version
        _.extend(plugin.metadata,
          _.omit(chosenVersionData.metadata, 'plugin_id', 'plugin_version'));
        // merge settings of a chosen plugin version
        this.attributes[pluginName] = _.extend(_.pick(plugin, 'metadata'),
          _.omit(chosenVersionData, 'metadata'));
      };

      _.each(pluginNames, mergeSettings);
    },
    toJSON() {
      var settings = this._super('toJSON', arguments);
      // update plugin settings
      _.each(settings, (section, sectionName) => {
        if (this.isPlugin(section)) {
          var chosenVersionData = section.metadata.versions.find(
              (version) => version.metadata.plugin_id === section.metadata.chosen_id
            );
          section.metadata = _.omit(section.metadata,
            _.without(_.keys(chosenVersionData.metadata), 'plugin_id', 'plugin_version'));
          _.each(section, (setting, settingName) => {
            if (settingName !== 'metadata') chosenVersionData[settingName].value = setting.value;
          });
          settings[sectionName] = _.pick(section, 'metadata');
        }
      });

      if (!this.root) return settings;
      return {[this.root]: settings};
    },
    initialize() {
      this.once('change', () => this.mergePluginSettings(), this);
    },
    validate(attrs, options) {
      var errors = {};
      var models = options ? options.models : {};
      var checkRestrictions = (setting) => this.checkRestrictions(models, null, setting);
      _.each(attrs, (group, groupName) => {
        if ((group.metadata || {}).enabled === false ||
          checkRestrictions(group.metadata).result) return;
        _.each(group, (setting, settingName) => {
          if (checkRestrictions(setting).result) return;
          var path = utils.makePath(groupName, settingName);
          // support of custom controls
          var CustomControl = customControls[setting.type];
          if (CustomControl && _.isFunction(CustomControl.validate)) {
            var error = CustomControl.validate(setting, models);
            if (error) errors[path] = error;
            return;
          }
          var inputError = Input.validate(setting);
          if (inputError) errors[path] = inputError;
        });
      });
      return _.isEmpty(errors) ? null : errors;
    },
    getValueAttribute(settingName) {
      return settingName === 'metadata' ? 'enabled' : 'value';
    },
    hasChanges(datatoCheck, models) {
      return _.some(this.attributes, (section, sectionName) => {
        // plugins installed to already deployed environment
        // are not presented in the environment deployed configuration
        var sectionToCheck = datatoCheck[sectionName];
        if (this.isPlugin(section) && !sectionToCheck) return section.metadata.enabled;

        var metadata = section.metadata;
        if (metadata) {
          if (!sectionToCheck.metadata) return false;
          // restrictions with action = 'none' should not block checking of the setting section
          if (this.checkRestrictions(models, ['disable', 'hide'], metadata).result) return false;
          // check the section enableness
          if (
            !_.isUndefined(metadata.enabled) && metadata.enabled !== sectionToCheck.metadata.enabled
          ) return true;
          // check a chosen plugin version
          if (
            this.isPlugin(section) && metadata.chosen_id !== sectionToCheck.metadata.chosen_id
          ) return true;
        }

        // do not check inactive setting sections
        if ((metadata || {}).enabled === false) return false;

        return _.some(_.omit(section, 'metadata'), (setting, settingName) => {
          // restrictions with action = 'none' should not block checking of the setting
          if (this.checkRestrictions(models, ['disable', 'hide'], setting).result) return false;
          return !_.isEqual(setting.value, (sectionToCheck[settingName] || {}).value);
        });
      });
    },
    sanitizeGroup(group) {
      return _.includes(this.groupList, group) ? group : 'other';
    },
    isSettingVisible(setting, settingName, configModels) {
      return settingName !== 'metadata' &&
        (setting.type !== 'hidden' || setting.description || setting.label) &&
        !this.checkRestrictions(configModels, 'hide', setting).result;
    },
    getGroupList() {
      var groups = [];
      _.each(this.attributes, (section) => {
        if (section.metadata.group) {
          groups.push(this.sanitizeGroup(section.metadata.group));
        } else {
          _.each(section, (setting, settingName) => {
            if (settingName !== 'metadata') groups.push(this.sanitizeGroup(setting.group));
          });
        }
      });
      return _.intersection(this.groupList, groups);
    },
    updateAttributes(newSettings, models, updateNetworkSettings) {
      /*
       * updateNetworkSettings (boolean):
       *   if true, update settings from 'network' group only
       *   if false, do not update settings from 'network' group
       *   if not specified (default), update all settings
      **/

      this.validationError = null;

      _.each(this.attributes, (section, sectionName) => {
        var isNetworkGroup = section.metadata.group === 'network';
        var shouldSectionBeUpdated = _.isUndefined(updateNetworkSettings) ||
          updateNetworkSettings === isNetworkGroup;

        if (shouldSectionBeUpdated) {
          if (this.isPlugin(section)) {
            if (newSettings.get(sectionName)) {
              var pathToMetadata = utils.makePath(sectionName, 'metadata');
              _.extend(
                this.get(pathToMetadata),
                _.pick(newSettings.get(pathToMetadata), 'enabled', 'chosen_id', 'versions')
              );
              this.mergePluginSettings(sectionName);
            }
          } else {
            _.each(section, (setting, settingName) => {
              // do not update hidden settings (hack for #1442143)
              var shouldSettingBeUpdated = setting.type !== 'hidden' && (
                _.isUndefined(updateNetworkSettings) ||
                isNetworkGroup ||
                setting.group !== 'network'
              );

              if (shouldSettingBeUpdated) {
                var path = utils.makePath(sectionName, settingName);
                this.set(path, newSettings.get(path));
              }
            });
          }
        }
      });
      this.isValid({models});
    }
  });

models.NodeAttributes = models.Settings.extend({
  constructorName: 'NodeAttributes',
  root: null
});

models.FuelSettings = models.Settings.extend({
  constructorName: 'FuelSettings',
  url: '/api/settings',
  root: 'settings',
  parse(response) {
    return _.extend(this._super('parse', arguments), {master_node_uid: response.master_node_uid});
  }
});

models.Disk = BaseModel.extend({
  constructorName: 'Disk',
  urlRoot: '/api/nodes/',
  editableAttributes: ['volumes', 'bootable'],
  parse(response) {
    response.volumes = new models.Volumes(response.volumes);
    response.volumes.disk = this;
    return response;
  },
  toJSON(options) {
    return _.extend(this.constructor.__super__.toJSON.call(this, options),
      {volumes: this.get('volumes').toJSON()});
  },
  getUnallocatedSpace(options) {
    options = options || {};
    var volumes = options.volumes || this.get('volumes');
    var allocatedSpace = volumes.reduce((sum, volume) => {
      return volume.get('name') === options.skip ? sum : sum + volume.get('size');
    }, 0);
    return this.get('size') - allocatedSpace;
  },
  validate(attrs) {
    var error;
    var unallocatedSpace = this.getUnallocatedSpace({volumes: attrs.volumes});
    if (unallocatedSpace < 0) {
      error = i18n('cluster_page.nodes_tab.configure_disks.validation_error',
        {size: utils.formatNumber(unallocatedSpace * -1)});
    }
    return error;
  }
});

models.Disks = BaseCollection.extend({
  constructorName: 'Disks',
  model: models.Disk,
  url: '/api/nodes/',
  comparator: 'name'
});

models.Volume = BaseModel.extend({
  constructorName: 'Volume',
  urlRoot: '/api/volumes/',
  getMinimalSize(minimum) {
    var currentDisk = this.collection.disk;
    var groupAllocatedSpace = 0;
    if (currentDisk && currentDisk.collection) {
      groupAllocatedSpace = currentDisk.collection.reduce((sum, disk) => {
        return disk.id === currentDisk.id ? sum : sum +
          disk.get('volumes').find({name: this.get('name')}).get('size');
      }, 0);
    }
    return minimum - groupAllocatedSpace;
  },
  getMaxSize() {
    var volumes = this.collection.disk.get('volumes');
    var diskAllocatedSpace = volumes.reduce((total, volume) => {
      return this.get('name') === volume.get('name') ? total : total + volume.get('size');
    }, 0);
    return this.collection.disk.get('size') - diskAllocatedSpace;
  },
  validate(attrs, options) {
    var min = this.getMinimalSize(options.minimum);
    if (attrs.size < min) {
      return i18n('cluster_page.nodes_tab.configure_disks.volume_error',
        {size: utils.formatNumber(min)});
    }
    return null;
  }
});

models.Volumes = BaseCollection.extend({
  constructorName: 'Volumes',
  model: models.Volume,
  url: '/api/volumes/'
});

models.Interface = BaseModel
  .extend(deepModelMixin)
  .extend({
    constructorName: 'Interface',
    parse(response) {
      response.assigned_networks = new models.InterfaceNetworks(response.assigned_networks);
      response.assigned_networks.interface = this;
      response.attributes = new models.NICAttributes(response.attributes);
      return response;
    },
    toJSON(options) {
      return _.omit(_.extend(this.constructor.__super__.toJSON.call(this, options), {
        assigned_networks: this.get('assigned_networks').toJSON(),
        attributes: this.get('attributes').toJSON()
      }), 'checked');
    },
    isBond() {
      return this.get('type') === 'bond';
    },
    getSlaveInterfaces() {
      if (!this.isBond()) return [this];
      var slaveNames = _.map(this.get('slaves'), 'name');
      return this.collection.filter((ifc) => _.includes(slaveNames, ifc.get('name')));
    },
    normalizeAttributePath(path) {
      path = _.isArray(path) ? path : path.split('.');
      if (_.first(path) !== 'attributes') {
        path.unshift('attributes');
      }
      if (_.last(path) !== 'value') {
        path.push('value');
      }
      return path.join('.');
    },
    getAttributeValue(path) {
      return this.get(this.normalizeAttributePath(path));
    },
    setAttributeValue(path, value, options) {
      this.set({
        [this.normalizeAttributePath(path)]: value
      }, options);
    },
    validate(attrs, options) {
      var errors = {};
      var networkErrors = [];
      var networks = new models.Networks(this.get('assigned_networks')
        .invokeMap('getFullNetwork', attrs.networks));
      var untaggedNetworks = networks.filter((network) => {
        return _.isNull(network.getVlanRange(attrs.networkingParameters));
      });
      var ns = 'cluster_page.nodes_tab.configure_interfaces.validation.';
      // public and floating networks are allowed to be assigned to the same interface
      var maxUntaggedNetworksCount = networks.some({name: 'public'}) &&
        networks.some({name: 'floating'}) ? 2 : 1;
      if (untaggedNetworks.length > maxUntaggedNetworksCount) {
        networkErrors.push(i18n(ns + 'too_many_untagged_networks'));
      }

      _.extend(errors, this.validateInterfaceProperties(options));
      this.get('attributes').validationError = errors.interface_properties;

      // check interface networks have the same vlan id
      var vlans = _.reject(networks.map('vlan_start'), _.isNull);
      if (_.uniq(vlans).length < vlans.length) {
        networkErrors.push(i18n(ns + 'networks_with_the_same_vlan'));
      }

      // check interface network vlan ids included in Neutron L2 vlan range
      var vlanRanges = _.reject(networks.map(
          (network) => network.getVlanRange(attrs.networkingParameters)
        ), _.isNull);
      if (
        _.some(vlanRanges,
          (currentRange) => _.some(vlanRanges,
            (range) => !_.isEqual(currentRange, range) &&
              range[1] >= currentRange[0] && range[0] <= currentRange[1]
          )
        )
      ) networkErrors.push(i18n(ns + 'vlan_range_intersection'));

      var sriov = this.get('attributes').sriov;
      if (sriov && sriov.enabled && sriov.enabled.value && networks.length) {
        networkErrors.push(i18n(ns + 'sriov_placement_error'));
      }

      if (
        this.getAttributeValue('dpdk.enabled') &&
        !_.isEqual(networks.map('name'), ['private'])
      ) {
        networkErrors.push(i18n(ns + 'dpdk_placement_error'));
      }

      if (networkErrors.length) {
        errors.network_errors = networkErrors;
      }
      return errors;
    },
    validateInterfaceProperties(options) {
      var attributes = this.get('attributes');
      if (!attributes) return null;
      var errors = {};
      var ns = 'cluster_page.nodes_tab.configure_interfaces.validation.';
      var mtuValue = parseInt(attributes.get('mtu.value.value'), 10);
      if (mtuValue) {
        if (_.isNaN(mtuValue) || mtuValue < 42 || mtuValue > 65536) {
          errors['mtu.value'] = i18n(ns + 'invalid_mtu');
        } else if (attributes.get('dpdk.enabled.value') && mtuValue > 1500) {
          errors['mtu.value'] = i18n(ns + 'dpdk_mtu_error');
        }
      }
      _.extend(errors, this.validateSRIOV(options), this.validateDPDK(options));
      return _.isEmpty(errors) ? null : {interface_properties: errors};
    },
    validateSRIOV({cluster}) {
      if (!this.get('meta')) {
        return null;
      }
      var sriovMeta = this.get('meta').sriov;
      var sriov = this.get('attributes').sriov;
      if (!sriovMeta || !sriov || !sriov.enabled.value) return null;
      var ns = 'cluster_page.nodes_tab.configure_interfaces.validation.';
      var errors = {};
      if (cluster.get('settings').get('common.libvirt_type.value') !== 'kvm') {
        errors.common = i18n(ns + 'sriov_hypervisor_alert');
      }
      var virtualFunctionsNumber = Number(sriov.numvfs.value);
      var totalVirtualFunctionsNumber = Number(sriov.sriov_totalvfs);
      if (_.isNaN(virtualFunctionsNumber) || virtualFunctionsNumber < 0) {
        errors.sriov_numvfs = i18n(ns + 'invalid_virtual_functions_number');
      } else if (!_.isNaN(totalVirtualFunctionsNumber) &&
        virtualFunctionsNumber > totalVirtualFunctionsNumber) {
        errors.sriov_numvfs = i18n(ns + 'invalid_virtual_functions_number_max',
          {max: totalVirtualFunctionsNumber}
        );
      }
      if (sriov.physnet.value && !sriov.physnet.value.match(utils.regexes.networkName)) {
        errors.physnet = i18n(ns + 'invalid_physnet');
      } else if (!_.trim(sriov.physnet.value)) {
        errors.physnet = i18n(ns + 'empty_physnet');
      }
      return _.isEmpty(errors) ? null : {sriov: errors};
    },
    validateDPDK({cluster}) {
      var dpdk = this.get('attributes').dpdk;
      if (!dpdk || !dpdk.enabled || !dpdk.enabled.value ||
          cluster.get('settings').get('common.libvirt_type.value') === 'kvm') return null;

      var ns = 'cluster_page.nodes_tab.configure_interfaces.validation.';
      return {dpdk: {common: i18n(ns + 'dpdk_hypervisor_alert')}};
    }
  });

models.Interfaces = BaseCollection.extend({
  constructorName: 'Interfaces',
  model: models.Interface,
  generateBondName(base) {
    var index, proposedName;
    for (index = 0; ; index += 1) {
      proposedName = base + index;
      if (!this.some({name: proposedName})) return proposedName;
    }
  },
  comparator(ifc1, ifc2) {
    return utils.multiSort(ifc1, ifc2, [{attr: 'isBond'}, {attr: 'name'}]);
  }
});

var networkPreferredOrder = ['public', 'floating', 'storage', 'management',
  'private', 'fixed', 'baremetal'];

models.InterfaceNetwork = BaseModel.extend({
  constructorName: 'InterfaceNetwork',
  getFullNetwork(networks) {
    return networks.find({name: this.get('name')});
  }
});

models.InterfaceNetworks = BaseCollection.extend({
  constructorName: 'InterfaceNetworks',
  model: models.InterfaceNetwork,
  comparator(network) {
    return _.indexOf(networkPreferredOrder, network.get('name'));
  }
});

models.Network = BaseModel.extend({
  constructorName: 'Network',
  getVlanRange(networkingParameters) {
    if (!this.get('meta').neutron_vlan_range) {
      var externalNetworkData = this.get('meta').ext_net_data;
      var vlanStart = externalNetworkData ?
        networkingParameters.get(externalNetworkData[0]) : this.get('vlan_start');
      return _.isNull(vlanStart) ? vlanStart :
        [vlanStart, externalNetworkData ?
          vlanStart + networkingParameters.get(externalNetworkData[1]) - 1 : vlanStart];
    }
    return networkingParameters.get('vlan_range');
  },
  getEditableAttributes() {
    if (!this.get('meta').configurable) return [];
    // meta attributes are stored as a list
    var editableAttributes = ['cidr', 'ip_ranges', 'vlan_start', ['notation']];
    if (this.get('meta').use_gateway) editableAttributes.push('gateway');
    return editableAttributes;
  }
});

models.Networks = BaseCollection.extend({
  constructorName: 'Networks',
  model: models.Network,
  comparator(network) {
    return _.indexOf(networkPreferredOrder, network.get('name'));
  }
});

models.NetworkingParameters = BaseModel.extend({
  constructorName: 'NetworkingParameters'
});

models.NetworkConfiguration = BaseModel.extend(cacheMixin).extend({
  constructorName: 'NetworkConfiguration',
  cacheFor: 60 * 1000,
  parse(response) {
    response.networks = new models.Networks(response.networks);
    response.networking_parameters = new models.NetworkingParameters(
      response.networking_parameters
    );
    return response;
  },
  toJSON() {
    return {
      networks: this.get('networks').toJSON(),
      networking_parameters: this.get('networking_parameters').toJSON()
    };
  },
  isNew() {
    return false;
  },
  updateEditableAttributes(newNetworkConfiguration, nodeNetworkGroups) {
    this.get('networks').each((network) => {
      var newNetwork = newNetworkConfiguration.get('networks').get(network.id);
      if (newNetwork) {
        _.each(network.getEditableAttributes(), (attribute) => {
          if (_.isArray(attribute)) {
            _.extend(network.get('meta'), _.pick(newNetwork.get('meta'), attribute));
            network.set('meta', network.get('meta'));
          } else {
            network.set(attribute, newNetwork.get(attribute));
          }
        });
      }
    });
    this.get('networking_parameters').set(
      _.cloneDeep(newNetworkConfiguration.get('networking_parameters').attributes)
    );
    this.isValid({nodeNetworkGroups});
  },
  validateNetworkIpRanges(network, cidr) {
    if (network.get('meta').notation === 'ip_ranges') {
      var errors = utils.validateIPRanges(network.get('ip_ranges'), cidr);
      return errors.length ? {ip_ranges: errors} : null;
    }
    return null;
  },
  validateFixedNetworksAmount(fixedNetworksAmount, fixedNetworkVlan) {
    if (!utils.isNaturalNumber(parseInt(fixedNetworksAmount, 10))) {
      return {fixed_networks_amount: i18n('cluster_page.network_tab.validation.invalid_amount')};
    }
    if (fixedNetworkVlan && fixedNetworksAmount > 4095 - fixedNetworkVlan) {
      return {fixed_networks_amount: i18n('cluster_page.network_tab.validation.need_more_vlan')};
    }
    return null;
  },
  validateNeutronSegmentationIdRange([idStart, idEnd], isVlanSegmentation, vlans = []) {
    var ns = 'cluster_page.network_tab.validation.';
    var maxId = isVlanSegmentation ? 4094 : 65535;
    var errors = _.map([idStart, idEnd], (id, index) => {
      return !utils.isNaturalNumber(id) || id < 2 || id > maxId ?
        i18n(ns + (index === 0 ? 'invalid_id_start' : 'invalid_id_end')) : '';
    });
    if (errors[0] || errors[1]) return errors;

    errors[0] = errors[1] = idStart === idEnd ?
        i18n(ns + 'not_enough_id')
      :
        idStart > idEnd ? i18n(ns + 'invalid_id_range') : '';
    if (errors[0] || errors[1]) return errors;

    if (isVlanSegmentation) {
      if (_.some(vlans, (vlan) => utils.validateVlanRange(idStart, idEnd, vlan))) {
        errors[0] = errors[1] = i18n(ns + 'vlan_intersection');
      }
    }
    return errors;
  },
  validateNeutronFloatingRange(floatingRanges, networks, networkErrors, nodeNetworkGroups) {
    var error = utils.validateIPRanges(floatingRanges, null);
    if (!_.isEmpty(error)) return error;

    var networksToCheck = networks.filter((network) => {
      var cidrError;
      try {
        cidrError = !!networkErrors[network.get('group_id')][network.id].cidr;
      } catch (ignore) {}
      if (cidrError || !network.get('meta').floating_range_var) return false;
      var [floatingRangeStart, floatingRangeEnd] = floatingRanges[0];
      var cidr = network.get('cidr');
      return utils.validateIpCorrespondsToCIDR(cidr, floatingRangeStart) &&
        utils.validateIpCorrespondsToCIDR(cidr, floatingRangeEnd);
    });

    if (networksToCheck.length) {
      _.each(networksToCheck, (network) => {
        error = utils.validateIPRanges(
          floatingRanges,
          network.get('cidr'),
          _.filter(network.get('ip_ranges'), (range, index) => {
            var ipRangeError = false;
            try {
              ipRangeError = !_.every(range) || _.some(
                  networkErrors[network.get('group_id')][network.id].ip_ranges,
                  {index: index}
                );
            } catch (ignore) {}
            return !ipRangeError;
          }),
          {
            IP_RANGES_INTERSECTION: i18n(
              'cluster_page.network_tab.validation.floating_and_public_ip_ranges_intersection',
              {
                cidr: network.get('cidr'),
                network: _.capitalize(network.get('name')),
                nodeNetworkGroup: nodeNetworkGroups.get(network.get('group_id')).get('name')
              }
            )
          }
        );
        return _.isEmpty(error);
      });
    } else {
      error = [{index: 0}];
      error[0].start = error[0].end =
        i18n('cluster_page.network_tab.validation.floating_range_is_not_in_public_cidr');
    }

    return error;
  },
  validateNetwork(network) {
    var cidr = network.get('cidr');
    var errors = {};

    _.extend(errors, utils.validateCidr(cidr));
    var cidrError = _.has(errors, 'cidr');

    _.extend(errors, this.validateNetworkIpRanges(network, cidrError ? null : cidr));

    if (network.get('meta').use_gateway) {
      _.extend(
        errors,
        utils.validateGateway(network.get('gateway'), cidrError ? null : cidr)
      );
    }

    _.extend(errors, utils.validateVlan(network.get('vlan_start')));

    return errors;
  },
  validateNeutronParameters(parameters, networks, networkErrors, nodeNetworkGroups) {
    var errors = {};

    var isVlanSegmentation = parameters.get('segmentation_type') === 'vlan';
    var idRangeAttributeName = isVlanSegmentation ? 'vlan_range' : 'gre_id_range';
    var idRangeErrors = this.validateNeutronSegmentationIdRange(
      _.map(parameters.get(idRangeAttributeName), Number),
      isVlanSegmentation,
      _.compact(networks.map('vlan_start'))
    );
    if (idRangeErrors[0] || idRangeErrors[1]) errors[idRangeAttributeName] = idRangeErrors;

    if (!parameters.get('base_mac').match(utils.regexes.mac)) {
      errors.base_mac = i18n('cluster_page.network_tab.validation.invalid_mac');
    }

    _.extend(errors, utils.validateCidr(parameters.get('internal_cidr'), 'internal_cidr'));

    _.extend(
      errors,
      utils.validateGateway(
        parameters.get('internal_gateway'),
        parameters.get('internal_cidr'),
        'internal_gateway'
      )
    );

    _.each(['internal_name', 'floating_name'], (attribute) => {
      if (!parameters.get(attribute).match(/^[a-z][\w\-]*$/i)) {
        errors[attribute] = i18n('cluster_page.network_tab.validation.invalid_name');
      }
    });

    var floatingRangeErrors = this.validateNeutronFloatingRange(
      parameters.get('floating_ranges'),
      networks,
      networkErrors,
      nodeNetworkGroups
    );
    if (floatingRangeErrors.length) errors.floating_ranges = floatingRangeErrors;

    return errors;
  },
  validateBaremetalParameters(cidr, networkingParameters) {
    var errors = {};

    _.extend(
      errors,
      utils.validateGateway(
        networkingParameters.get('baremetal_gateway'),
        cidr,
        'baremetal_gateway'
      )
    );

    var baremetalRangeErrors = utils.validateIPRanges(
      [networkingParameters.get('baremetal_range')],
      cidr
    );
    if (baremetalRangeErrors.length) {
      var [{start, end}] = baremetalRangeErrors;
      errors.baremetal_range = [start, end];
    }

    return errors;
  },
  validateNameServers(nameservers) {
    var errors = _.map(nameservers,
      (nameserver) => !utils.validateIP(nameserver) ?
        i18n('cluster_page.network_tab.validation.invalid_nameserver') : null
    );
    if (_.compact(errors).length) return {dns_nameservers: errors};
  },
  validate(attrs, options = {}) {
    var networkingParameters = attrs.networking_parameters;

    var errors = {};

    // validate networks
    var nodeNetworkGroupsErrors = {};
    options.nodeNetworkGroups.map((nodeNetworkGroup) => {
      var nodeNetworkGroupErrors = {};
      var networksToCheck = new models.Networks(attrs.networks.filter((network) => {
        return network.get('group_id') === nodeNetworkGroup.id && network.get('meta').configurable;
      }));
      networksToCheck.each((network) => {
        var networkErrors = this.validateNetwork(network);
        if (!_.isEmpty(networkErrors)) nodeNetworkGroupErrors[network.id] = networkErrors;
      });
      if (!_.isEmpty(nodeNetworkGroupErrors)) {
        nodeNetworkGroupsErrors[nodeNetworkGroup.id] = nodeNetworkGroupErrors;
      }
    });
    if (!_.isEmpty(nodeNetworkGroupsErrors)) errors.networks = nodeNetworkGroupsErrors;

    // validate networking parameters
    var networkingParametersErrors = this.validateNeutronParameters(
      networkingParameters,
      attrs.networks,
      errors.networks,
      options.nodeNetworkGroups
    );

    // it is only one baremetal network in environment
    // so node network group filter is not needed here
    var baremetalNetwork = attrs.networks.find({name: 'baremetal'});
    if (baremetalNetwork) {
      var baremetalCidrError = false;
      try {
        baremetalCidrError = errors
          .networks[baremetalNetwork.get('group_id')][baremetalNetwork.id].cidr;
      } catch (error) {}
      _.extend(
        networkingParametersErrors,
        this.validateBaremetalParameters(
          baremetalCidrError ? null : baremetalNetwork.get('cidr'),
          networkingParameters
        )
      );
    }

    _.extend(
      networkingParametersErrors,
      this.validateNameServers(networkingParameters.get('dns_nameservers'))
    );

    if (!_.isEmpty(networkingParametersErrors)) {
      errors.networking_parameters = networkingParametersErrors;
    }

    return _.isEmpty(errors) ? null : errors;
  }
});

models.LogSource = BaseModel.extend({
  constructorName: 'LogSource',
  urlRoot: '/api/logs/sources'
});

models.LogSources = BaseCollection.extend({
  constructorName: 'LogSources',
  model: models.LogSource,
  url: '/api/logs/sources'
});

models.TestSet = BaseModel.extend({
  constructorName: 'TestSet',
  urlRoot: '/ostf/testsets'
});

models.TestSets = BaseCollection.extend({
  constructorName: 'TestSets',
  model: models.TestSet,
  url: '/ostf/testsets'
});

models.Test = BaseModel.extend({
  constructorName: 'Test',
  urlRoot: '/ostf/tests'
});

models.Tests = BaseCollection.extend({
  constructorName: 'Tests',
  model: models.Test,
  url: '/ostf/tests'
});

models.TestRun = BaseModel.extend({
  constructorName: 'TestRun',
  urlRoot: '/ostf/testruns'
});

models.TestRuns = BaseCollection.extend({
  constructorName: 'TestRuns',
  model: models.TestRun,
  url: '/ostf/testruns'
});

models.OSTFClusterMetadata = BaseModel.extend({
  constructorName: 'OSTFClusterMetadata',
  urlRoot: '/api/ostf'
});

models.FuelVersion = BaseModel.extend(cacheMixin).extend({
  cacheFor: 60 * 1000,
  constructorName: 'FuelVersion',
  urlRoot: '/api/version'
});

models.User = BaseModel.extend({
  constructorName: 'User',
  locallyStoredAttributes: ['username', 'token'],
  initialize() {
    _.each(this.locallyStoredAttributes, (attribute) => {
      var locallyStoredValue = localStorage.getItem(attribute);
      if (locallyStoredValue) {
        this.set(attribute, locallyStoredValue);
      }
      this.on('change:' + attribute, (model, value) => {
        if (_.isUndefined(value)) {
          localStorage.removeItem(attribute);
        } else {
          localStorage.setItem(attribute, value);
        }
      });
    });
    this.on('change:token', () => {
      var token = this.get('token');
      if (_.isUndefined(token)) {
        Cookies.remove('token');
      } else {
        Cookies.set('token', token);
      }
    });
  }
});

models.LogsPackage = BaseModel.extend({
  constructorName: 'LogsPackage',
  urlRoot: '/api/logs/package'
});

models.CapacityLog = BaseModel.extend({
  constructorName: 'CapacityLog',
  urlRoot: '/api/capacity'
});

models.NodeNetworkGroup = BaseModel.extend({
  constructorName: 'NodeNetworkGroup',
  urlRoot: '/api/nodegroups',
  validate(options = {}) {
    var newName = _.trim(options.name) || '';
    if (!newName) {
      return i18n('cluster_page.network_tab.node_network_group_empty_name');
    }
    if ((this.collection || options.nodeNetworkGroups).some({name: newName})) {
      return i18n('cluster_page.network_tab.node_network_group_duplicate_error');
    }
    return null;
  }
});

models.NodeNetworkGroups = BaseCollection.extend({
  constructorName: 'NodeNetworkGroups',
  model: models.NodeNetworkGroup,
  url: '/api/nodegroups',
  comparator: (nodeNetworkGroup) => -nodeNetworkGroup.get('is_default')
});

models.PluginLink = BaseModel.extend({
  constructorName: 'PluginLink'
});

models.PluginLinks = BaseCollection.extend(cacheMixin).extend({
  constructorName: 'PluginLinks',
  cacheFor: 60 * 1000,
  model: models.PluginLink,
  comparator: 'id'
});

class ComponentPattern {
  constructor(pattern) {
    this.pattern = pattern;
    this.parts = pattern.split(':');
    this.hasWildcard = _.includes(this.parts, '*');
  }
  match(componentName) {
    if (!this.hasWildcard) {
      return this.pattern === componentName;
    }

    var componentParts = componentName.split(':');
    if (componentParts.length < this.parts.length) {
      return false;
    }
    var matched = true;
    _.each(this.parts, (part, index) => {
      if (part !== '*') {
        if (part !== componentParts[index]) {
          matched = false;
          return matched;
        }
      }
    });
    return matched;
  }
}

models.ComponentModel = BaseModel.extend({
  initialize(component) {
    var parts = component.name.split(':');
    this.set({
      id: component.name,
      enabled: component.enabled,
      type: parts[0],
      subtype: parts[1],
      name: component.name,
      label: i18n(component.label),
      description: component.description && i18n(component.description),
      compatible: component.compatible,
      incompatible: component.incompatible,
      weight: component.weight || 100
    });
  },
  expandWildcards(components) {
    var expandProperty = (propertyName, components) => {
      var expandedComponents = [];
      _.each(this.get(propertyName), (patternDescription) => {
        var patternName = _.isString(patternDescription) ? patternDescription :
          patternDescription.name;
        var pattern = new ComponentPattern(patternName);
        components.each((component) => {
          if (pattern.match(component.id)) {
            expandedComponents.push({
              component: component,
              message: i18n(patternDescription.message || '')
            });
          }
        });
      });
      return expandedComponents;
    };

    this.set({
      compatible: expandProperty('compatible', components),
      incompatible: expandProperty('incompatible', components)
    });
  },
  predicates: {
    one_of: (processedComponents = [], forthcomingComponents = []) => {
      var enabledLength =
        _.filter(processedComponents, (component) => component.get('enabled')).length;
      var processedLength = processedComponents.length;
      var forthcomingLength = forthcomingComponents.length;
      return {
        matched: (enabledLength === 0 && forthcomingLength > 0) || enabledLength === 1,
        invalid: processedLength === 0 && forthcomingLength === 0
      };
    },
    none_of: (processedComponents = []) => {
      var enabledLength =
        _.filter(processedComponents, (component) => component.get('enabled')).length;
      return {
        matched: enabledLength === 0,
        invalid: false
      };
    },
    any_of: (processedComponents = [], forthcomingComponents = []) => {
      var enabledLength =
        _.filter(processedComponents, (component) => component.get('enabled')).length;
      var processedLength = processedComponents.length;
      var forthcomingLength = forthcomingComponents.length;
      return {
        matched: (enabledLength === 0 && forthcomingLength > 0) || enabledLength >= 1,
        invalid: processedLength === 0 && forthcomingLength === 0
      };
    },
    all_of: (processedComponents = [], forthcomingComponents = []) => {
      var processedLength = processedComponents.length;
      var forthcomingLength = forthcomingComponents.length;
      return {
        matched: _.every(processedComponents, (component) => component.get('enabled')),
        invalid: processedLength === 0 && forthcomingLength === 0
      };
    }
  },
  preprocessRequires(components) {
    var componentIndex = {};
    components.each((component) => {
      componentIndex[component.id] = component;
    });

    var requires = this.get('requires');
    if (requires && _.every(requires, (item) => item.name)) {
      // convert old requires format to a new one
      var newFormat = [
        {
          all_of: {
            items: requires.map((require) => require.name),
            message: _.last(requires).message
          }
        }
      ];
      this.set({requires: newFormat});
    }

    var predicateNames = ['one_of', 'none_of', 'any_of', 'all_of'];
    requires = _.map(this.get('requires'), (require) => {
      var condition = {};
      _.each(predicateNames, (predicate) => {
        if (!_.isObject(require[predicate])) {
          return true;
        }
        condition = _.extend(require[predicate], {predicate});
        condition.items = _.map(condition.items, (name) => componentIndex[name]);
        return false;
      });
      return condition;
    });
    this.set({requires});
  },
  processRequires(currentPaneIndex, paneMap) {
    var result = _.reduce(this.get('requires'), (result, require) => {
      var groupedComponents = _.groupBy(require.items, (item) => {
        if (!item) {
          return 'null';
        }
        var index = paneMap[item.get('type')];
        return index <= currentPaneIndex ? 'processed' : 'forthcoming';
      });
      var predicate = this.predicates[require.predicate];
      var predicateResult = predicate(groupedComponents.processed, groupedComponents.forthcoming);
      var message = predicateResult.invalid ? require.message_invalid : require.message;
      result.push(_.extend(predicateResult, {message: predicateResult.matched ? null : message}));
      return result;
    }, []);
    var allMatched = _.every(result, (item) => item.matched);
    this.set({
      requireFail: !allMatched,
      invalid: _.some(result, (item) => item.invalid)
    });
    return {
      matched: allMatched,
      warnings: _.compact(_.map(result, (item) => i18n(item.message))).join(' ')
    };
  },
  restoreDefaultValue() {
    this.set({enabled: this.get('default')});
  },
  toJSON() {
    return this.get('enabled') ? this.id : null;
  },
  isML2Driver() {
    return /:ml2:\w+$/.test(this.id);
  }
});

models.ComponentsCollection = BaseCollection.extend({
  model: models.ComponentModel,
  allTypes: ['hypervisor', 'network', 'storage', 'additional_service'],
  initialize(models, options) {
    this.releaseId = options.releaseId;
    this.paneMap = {};
    _.each(this.allTypes, (type, index) => {
      this.paneMap[type] = index;
    });
  },
  url() {
    return '/api/v1/releases/' + this.releaseId + '/components';
  },
  parse(response) {
    return _.isArray(response) ? response : [];
  },
  getComponentsByType(type, options = {sorted: true}) {
    var components = this.filter({type});
    if (options.sorted) {
      components.sort((component1, component2) => {
        return component1.get('weight') - component2.get('weight');
      });
    }
    return components;
  },
  restoreDefaultValues(types) {
    types = types || this.allTypes;
    var components = _.filter(this.models, (model) => _.includes(types, model.get('type')));
    _.invokeMap(components, 'restoreDefaultValue');
  },
  toJSON() {
    return _.compact(_.map(this.models, (model) => model.toJSON()));
  },
  processPaneRequires(paneType) {
    var currentPaneIndex = this.paneMap[paneType];
    this.each((component) => {
      var componentPaneIndex = this.paneMap[component.get('type')];
      if (component.get('disabled') || componentPaneIndex > currentPaneIndex) {
        return;
      }
      var result = component.processRequires(currentPaneIndex, this.paneMap);
      var isDisabled = !result.matched;
      if (componentPaneIndex === currentPaneIndex) {
        // current pane handling
        component.set({
          disabled: isDisabled,
          warnings: isDisabled ? result.warnings : null,
          enabled: isDisabled ? false : component.get('enabled'),
          availability: 'incompatible'
        });
      } else if (!result.matched) {
        // previous pane handling
        component.set({
          warnings: result.warnings
        });
      }
    });
  },
  validate(paneType) {
    // all the past panes should have all restrictions matched
    // when not, errors dictionary is set
    this.validationError = null;
    var errors = [];
    var currentPaneIndex = this.paneMap[paneType];
    this.each((component) => {
      var componentPaneIndex = this.paneMap[component.get('type')];
      if (componentPaneIndex >= currentPaneIndex) {
        return;
      }
      if (component.get('enabled') && component.get('requireFail')) {
        errors.push(component.get('warnings'));
      }
    });
    if (errors.length > 0) {
      this.validationError = errors;
    }
  }
});

models.NICAttributes = BaseModel
  .extend(deepModelMixin)
  .extend({
    constructorName: 'NICAttributes'
  });

models.BondDefaultAttributes = BaseModel
  .extend(deepModelMixin)
  .extend(cacheMixin)
  .extend({
    constructorName: 'BondDefaultAttributes',
    url() {
      return '/api/v1/nodes/' + this.id + '/bonds/attributes/defaults';
    }
  });

export default models;
