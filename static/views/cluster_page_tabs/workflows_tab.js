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
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import models from 'models';

var WorkflowsTab;

WorkflowsTab = React.createClass({
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.workflows'), null, {active: true}]
      ];
    },
    fetchData({cluster}) {
      var deploymentGraphs = cluster.get('deploymentGraphs');
      var plugins = new models.Plugins();
      return deploymentGraphs.fetch({cache: true})
        .then(() => {
          if (_.some(deploymentGraphs, (graph) => graph.get('relations').model === 'plugin')) {
            return plugins.fetch();
          }
          return Promise.resolve();
        })
        .then(() => ({plugins}));
    }
  },
  downloadGraph(graphType) {

  },
  deleteGraph(graphId) {

  },
  render() {
    var {cluster, plugins} = this.props;
    var ns = 'cluster_page.workflows_tab.';

    var deploymentGraphs = cluster.get('deploymentGraphs').groupBy(
      (graph) => graph.get('relations').model
    );

    return (
      <div className='row'>
        <div className='title col-xs-12'>
          {i18n(ns + 'title')}
        </div>
        <div className='wrapper col-xs-12'>
          <table className='table table-bordered table-striped'>
            <thead>
              <tr>
                <th>{i18n(ns + 'graph_name_header')}</th>
                <th>{i18n(ns + 'graph_type_header')}</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {_.map(deploymentGraphs, (graphs, graphLevel) => {
                return [
                  <tr key='subheader' className='subheader'>
                    <td colSpan='4'>
                      {i18n(ns + graphLevel + '_graph_level', {
                        plugin: graphLevel === 'plugin' &&
                          plugins.get(graphs.at(0).get('relations').model_id).get('name')
                      })}
                    </td>
                  </tr>
                ].concat(
                  _.map(graphs, (graph) => {
                    var type = graph.get('relations').type;
                    return <tr key={graph.id}>
                      <td>{graph.get('name')}</td>
                      <td>{type}</td>
                      <td>
                        { // FIXME(jaranovich): there is no handler to download tasks JSON of graph
                          // of 'cluster' level (#1605639)
                          graphLevel !== 'cluster' &&
                            <button
                              className='btn btn-link'
                              onClick={() => this.downloadGraph(type)}
                            >
                              {i18n(ns + 'download_graph')}
                            </button>
                        }
                      </td>
                      <td>
                        {graphLevel === 'cluster' &&
                          <button
                            className='btn btn-link'
                            onClick={() => this.deleteGraph(graph.id)}
                          >
                            {i18n(ns + 'delete_graph')}
                          </button>
                        }
                      </td>
                    </tr>;
                  })
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
});

export default WorkflowsTab;
