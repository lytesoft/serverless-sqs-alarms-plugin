'use strict'

const _ = require('lodash')

class Alarm {
  constructor (alarm, region, serviceName, stage) {
    this.queueName = alarm.queueName
    this.topic = alarm.topic
    this.region = region
    this.thresholds = alarm.thresholds
    this.name = alarm.name
    this.treatMissingData = alarm.treatMissingData
    this.serviceName = serviceName
    this.stage = stage
  }

  formatAlarmName (queueName, value) {
    // Cloud Watch alarms must be alphanumeric only
    let finalQueueName = queueName.replace(/[^0-9a-z]/gi, '')
    return `${finalQueueName}MessageAlarm${value}`;
  }

  generateResource () {
    return this.thresholds.map(
      (properties, i) => {
        console.log(properties);
        const config = {
          [this.formatAlarmName(this.queueName, properties.value)]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
              AlarmName: 
              `${this.serviceName}-${this.stage}-${this.formatAlarmName(this.queueName.replace(`${this.serviceName}-${this.stage}`,"") ,properties.value)}`,
              AlarmDescription: properties.description || `Custom alarm for ${this.queueName}`,
              Namespace: properties.namespace || 'AWS/SQS',
              MetricName: this.metricName || 'NumberOfMessagesSent', // 'ApproximateNumberOfMessagesVisible'
              Dimensions: [
                {
                  Name: 'QueueName',
                  Value: this.queueName
                }
              ],
              Statistic: properties.statistic || "Sum",
              Period: properties.period || 60,
              EvaluationPeriods: properties.evaluationPeriods || 1,
              Threshold: properties.value,
              ComparisonOperator: properties.operator || 'GreaterThanOrEqualToThreshold',
              AlarmActions: properties.alarmActions || [],
              OKActions: properties.okActions || [],
              TreatMissingData: properties.treatMissingData || "missing"
            }
          }
        }
        console.log(config);
        return config
      }
    )
  }
}

class Plugin {
  constructor (serverless, options) {
    this.serverless = serverless
    this.hooks = {
      'package:compileEvents': this.beforeDeployResources.bind(this)
    }
  }

  beforeDeployResources () {
    if (!this.serverless.service.custom || !this.serverless.service.custom['sqs-alarms']) {
      return
    }

    const alarms = this.serverless.service.custom['sqs-alarms'].map(
      data => new Alarm(data, this.serverless.getProvider('aws').getRegion(), 
      this.serverless.service.service, this.serverless.service.provider.stage)
    )

    alarms.forEach(
      alarm => alarm.generateResource().forEach(
        resrc => {
          _.merge(
            this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
            resrc
          )
        }
      )
    )
    throw new Error("just testing");
  }
}

module.exports = Plugin
