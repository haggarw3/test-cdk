"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCdkStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const sfn = require("aws-cdk-lib/aws-stepfunctions");
const tasks = require("aws-cdk-lib/aws-stepfunctions-tasks");
const sns = require("aws-cdk-lib/aws-sns");
const subscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
const events = require("aws-cdk-lib/aws-events"); // additional modules imported
const targets = require("aws-cdk-lib/aws-events-targets"); // additional modules imported
const iam = require("aws-cdk-lib/aws-iam");
const ssm = require("aws-cdk-lib/aws-ssm");
class TestCdkStack extends cdk.Stack {
    constructor(scope, id) {
        var _a;
        super(scope, id);
        const username = new ssm.StringParameter(this, 'test-username', {
            parameterName: 'database-username',
            stringValue: 'awsuser',
            description: 'the username for redshift',
            type: ssm.ParameterType.STRING,
            tier: ssm.ParameterTier.STANDARD,
            allowedPattern: '.*',
        });
        const password = new ssm.StringParameter(this, 'test-password', {
            parameterName: 'database-password',
            stringValue: 'AWSUser5439',
            description: 'the password for redshift',
            type: ssm.ParameterType.STRING,
            tier: ssm.ParameterTier.ADVANCED,
            allowedPattern: '.*',
        });
        const importedParam_username = ssm.StringParameter.fromStringParameterAttributes(this, 'imported-username', { parameterName: 'database-password', version: 1 });
        const importedParam_password = ssm.StringParameter.fromStringParameterAttributes(this, 'imported-password', { parameterName: 'database-username', version: 1 });
        const imported_secure_Param_password = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'imported-secure-password', { parameterName: 'test-redshift-username', version: 1 });
        const startQueryExecutionJob_create_table_billing_requirement = new tasks.AthenaStartQueryExecution(this, 'Athena Query Test', {
            workGroup: 'primary',
            queryString: sfn.JsonPath.format('select * from '),
            queryExecutionContext: {
                databaseName: 'core_profile_cdk',
            },
            resultConfiguration: {
                encryptionConfiguration: {
                    encryptionOption: tasks.EncryptionOption.S3_MANAGED,
                },
                outputLocation: {
                    bucketName: 'core_profile_cdk',
                    objectKey: 'billing_requirement',
                },
            },
            integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        });
        // crawler definition
        const crawler_test_cdk = new aws_cdk_lib_1.aws_glue.CfnCrawler(this, 'crawler_test_cdk_for_sns', {
            role: 'arn:aws:iam::464340339497:role/service-role/AWSGlueServiceRole-Datalake',
            targets: {
                // this is the path to source data in core profile dev account
                s3Targets: [{
                        path: 's3://so/'
                    }],
            },
            databaseName: 'core_profile_cdk',
            description: 'This is the crawler to read the schema of the source data from core profile dev account',
            // Note: This is the name of the crawler that is created in AWS console
            name: 'crawler_test_cdk_for_sns',
            // TO DO
            // schedule: {
            //   scheduleExpression: 'scheduleExpression',
            // },
            schemaChangePolicy: {
                deleteBehavior: 'LOG',
                updateBehavior: 'UPDATE_IN_DATABASE',
            },
            tablePrefix: 'source_'
        });
        const crawler_lambda = new lambda.Function(this, 'lambda_crawler_sns', {
            runtime: lambda.Runtime.PYTHON_3_7,
            code: lambda.Code.fromAsset("lambda"),
            handler: 'lambda_crawler_sns.lambda_handler',
            timeout: cdk.Duration.minutes(10),
        });
        // create a policy
        const permissions_to_glue_crawler_lambda = new iam.PolicyStatement({
            actions: ['glue:*'],
            resources: ['*'],
        });
        // add the policy to the Function's role
        (_a = crawler_lambda.role) === null || _a === void 0 ? void 0 : _a.attachInlinePolicy(new iam.Policy(this, 'glue crawler source data cross account', {
            statements: [permissions_to_glue_crawler_lambda],
        }));
        const sns_crawler = new tasks.LambdaInvoke(this, 'Crawler Lambda SNS', {
            lambdaFunction: crawler_lambda,
            // Lambda's result is in the attribute `Payload`
            outputPath: '$.Payload',
        });
        // Create SNS topic 
        const topic = new sns.Topic(this, 'Topic', {
            displayName: 'testing sns notifications using cdk',
        });
        // Create subscription
        topic.addSubscription(new subscriptions.EmailSubscription('himanshu.aggarwal_ext@michelin.com'));
        topic.addSubscription(new subscriptions.EmailSubscription('himanshuagg1991@gmail.com'));
        /////
        const definition = sns_crawler
            .next(startQueryExecutionJob_create_table_billing_requirement);
        const state_machine = new sfn.StateMachine(this, 'test_sns', {
            definition
        });
        // set the rule how the notifications are sent 
        // Here in the rule we specify which AWS resource that will be checked for the statuses mentioned in the event pattern
        const rule1 = new events.Rule(this, 'stepfunctions rule', {
            eventPattern: {
                "source": ["aws.states"],
                "detail": {
                    "status": ["FAILED", "TIMED_OUT", "ABORTED"],
                    "stateMachineArn": [`${state_machine.stateMachineArn}`]
                }
            },
        });
        // Add a target to the rule created 
        rule1.addTarget(new targets.SnsTopic(topic, {
        // check how we can set the prop retryAttempts
        }));
        /////// check SNS with glue crawler -
        // Rule for the crawler
        const rule2 = new events.Rule(this, 'glue crawler rule', {
            eventPattern: {
                "source": ["aws.glue"],
                "account": ["464340339497"],
                "region": ["us-east-1"],
                "detail": {
                    "crawlerName": ["crawler_test_cdk_for_sns"],
                    "state": ["Failed"],
                    "message": ["Crawler Failed"]
                }
            },
        });
        rule2.addTarget(new targets.SnsTopic(topic, {
        // check how we can set the prop retryAttempts
        }));
    }
}
exports.TestCdkStack = TestCdkStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdF9jZGstc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0ZXN0X2Nkay1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsaURBQWlEO0FBQ2pELDZDQUErQztBQUMvQyxxREFBcUQ7QUFDckQsNkRBQTZEO0FBQzdELDJDQUEyQztBQUMzQyxtRUFBbUU7QUFDbkUsaURBQWlELENBQVUsOEJBQThCO0FBQ3pGLDBEQUEwRCxDQUFDLDhCQUE4QjtBQUl6RiwyQ0FBMkM7QUFJM0MsMkNBQTJDO0FBRTNDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pDLFlBQVksS0FBYyxFQUFFLEVBQVU7O1FBQ3BDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDOUQsYUFBYSxFQUFFLG1CQUFtQjtZQUNsQyxXQUFXLEVBQUUsU0FBUztZQUN0QixXQUFXLEVBQUUsMkJBQTJCO1lBQ3hDLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07WUFDOUIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUTtZQUNoQyxjQUFjLEVBQUUsSUFBSTtTQUNyQixDQUFDLENBQUM7UUFFSCxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM5RCxhQUFhLEVBQUUsbUJBQW1CO1lBQ2xDLFdBQVcsRUFBRSxhQUFhO1lBQzFCLFdBQVcsRUFBRSwyQkFBMkI7WUFDeEMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUM5QixJQUFJLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRO1lBQ2hDLGNBQWMsRUFBRSxJQUFJO1NBQ3JCLENBQUMsQ0FBQztRQUdILE1BQU0sc0JB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LElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUc7UUFDM0MsOENBQThDO1NBQy9DLENBQUMsQ0FBQyxDQUFDO1FBR0oscUNBQXFDO1FBQ3JDLHVCQUF1QjtRQUN2QixNQUFNLEtBQUssR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3ZELFlBQVksRUFBRTtnQkFDWixRQUFRLEVBQUUsQ0FBQyxVQUFVLENBQUM7Z0JBQ3RCLFNBQVMsRUFBRSxDQUFDLGNBQWMsQ0FBQztnQkFDM0IsUUFBUSxFQUFFLENBQUMsV0FBVyxDQUFDO2dCQUN2QixRQUFRLEVBQUU7b0JBQ1IsYUFBYSxFQUFFLENBQUMsMEJBQTBCLENBQUM7b0JBQzNDLE9BQU8sRUFBRSxDQUFDLFFBQVEsQ0FBQztvQkFDbkIsU0FBUyxFQUFFLENBQUMsZ0JBQWdCLENBQUM7aUJBQzlCO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUc7UUFDM0MsOENBQThDO1NBQy9DLENBQUMsQ0FBQyxDQUFDO0lBRU4sQ0FBQztDQUNGO0FBOUtELG9DQThLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBhd3NfczMgYXMgczMgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBhd3NfZ2x1ZSBhcyBnbHVlIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgc2ZuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zdGVwZnVuY3Rpb25zJztcbmltcG9ydCAqIGFzIHRhc2tzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucy10YXNrc1wiO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnOyAgICAgICAgICAvLyBhZGRpdGlvbmFsIG1vZHVsZXMgaW1wb3J0ZWRcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJzsgLy8gYWRkaXRpb25hbCBtb2R1bGVzIGltcG9ydGVkXG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBhdGhlbmEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWF0aGVuYSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IGNvbnN0YW50cyB9IGZyb20gJ29zJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuXG5pbXBvcnQgKiBhcyBzc20gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNzbSc7XG5cbmV4cG9ydCBjbGFzcyBUZXN0Q2RrU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkFwcCwgaWQ6IHN0cmluZykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB1c2VybmFtZSA9IG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICd0ZXN0LXVzZXJuYW1lJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2RhdGFiYXNlLXVzZXJuYW1lJyxcbiAgICAgIHN0cmluZ1ZhbHVlOiAnYXdzdXNlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ3RoZSB1c2VybmFtZSBmb3IgcmVkc2hpZnQnLFxuICAgICAgdHlwZTogc3NtLlBhcmFtZXRlclR5cGUuU1RSSU5HLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuU1RBTkRBUkQsIC8vIEFEVkFOQ0VEIHBhcmFtZXRlcnMgbGV0IHVzIHN0b3JlIHZhbHVlcyBvZiB1cCB0byA4S0IsIGNvbXBhcmVkIHRvIDRLQiB3aXRoIFNUQU5EQVJEIHBhcmFtZXRlcnNcbiAgICAgIGFsbG93ZWRQYXR0ZXJuOiAnLionLCAvL2EgcmVndWxhciBleHByZXNzaW9uIHRoYXQgdmFsaWRhdGVzIHRoZSBwcm92aWRlZCBwYXJhbWV0ZXIgdmFsdWVcbiAgICB9KTtcblxuICAgIGNvbnN0IHBhc3N3b3JkID0gbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ3Rlc3QtcGFzc3dvcmQnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZGF0YWJhc2UtcGFzc3dvcmQnLFxuICAgICAgc3RyaW5nVmFsdWU6ICdBV1NVc2VyNTQzOScsXG4gICAgICBkZXNjcmlwdGlvbjogJ3RoZSBwYXNzd29yZCBmb3IgcmVkc2hpZnQnLFxuICAgICAgdHlwZTogc3NtLlBhcmFtZXRlclR5cGUuU1RSSU5HLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuQURWQU5DRUQsIC8vQURWQU5DRUQgcGFyYW1ldGVycyBsZXQgdXMgc3RvcmUgdmFsdWVzIG9mIHVwIHRvIDhLQiwgY29tcGFyZWQgdG8gNEtCIHdpdGggU1RBTkRBUkQgcGFyYW1ldGVyc1xuICAgICAgYWxsb3dlZFBhdHRlcm46ICcuKicsIC8vIGEgcmVndWxhciBleHByZXNzaW9uIHRoYXQgdmFsaWRhdGVzIHRoZSBwcm92aWRlZCBwYXJhbWV0ZXIgdmFsdWVcbiAgICB9KTtcblxuXG4gICAgY29uc3QgaW1wb3J0ZWRQYXJhbV91c2VybmFtZSA9XG4gICAgICBzc20uU3RyaW5nUGFyYW1ldGVyLmZyb21TdHJpbmdQYXJhbWV0ZXJBdHRyaWJ1dGVzKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnaW1wb3J0ZWQtdXNlcm5hbWUnLFxuICAgICAgICB7cGFyYW1ldGVyTmFtZTogJ2RhdGFiYXNlLXBhc3N3b3JkJywgdmVyc2lvbjogMX0sXG4gICAgICApO1xuXG4gICAgY29uc3QgaW1wb3J0ZWRQYXJhbV9wYXNzd29yZCA9XG4gICAgc3NtLlN0cmluZ1BhcmFtZXRlci5mcm9tU3RyaW5nUGFyYW1ldGVyQXR0cmlidXRlcyhcbiAgICAgIHRoaXMsXG4gICAgICAnaW1wb3J0ZWQtcGFzc3dvcmQnLFxuICAgICAge3BhcmFtZXRlck5hbWU6ICdkYXRhYmFzZS11c2VybmFtZScsIHZlcnNpb246IDF9LFxuICAgICk7XG5cbiAgICBjb25zdCBpbXBvcnRlZF9zZWN1cmVfUGFyYW1fcGFzc3dvcmQgPVxuICAgIHNzbS5TdHJpbmdQYXJhbWV0ZXIuZnJvbVNlY3VyZVN0cmluZ1BhcmFtZXRlckF0dHJpYnV0ZXMoXG4gICAgICB0aGlzLFxuICAgICAgJ2ltcG9ydGVkLXNlY3VyZS1wYXNzd29yZCcsXG4gICAgICB7cGFyYW1ldGVyTmFtZTogJ3Rlc3QtcmVkc2hpZnQtdXNlcm5hbWUnLCB2ZXJzaW9uOiAxfSxcbiAgICApO1xuXG4gICAgXG5cblxuXG5cbiAgICBjb25zdCBzdGFydFF1ZXJ5RXhlY3V0aW9uSm9iX2NyZWF0ZV90YWJsZV9iaWxsaW5nX3JlcXVpcmVtZW50ID0gXG4gICAgbmV3IHRhc2tzLkF0aGVuYVN0YXJ0UXVlcnlFeGVjdXRpb24odGhpcywgJ0F0aGVuYSBRdWVyeSBUZXN0Jywge1xuICAgIHdvcmtHcm91cDogJ3ByaW1hcnknLCAgXG4gICAgcXVlcnlTdHJpbmc6IHNmbi5Kc29uUGF0aC5mb3JtYXQoJ3NlbGVjdCAqIGZyb20gJyksXG4gICAgcXVlcnlFeGVjdXRpb25Db250ZXh0OiB7XG4gICAgICBkYXRhYmFzZU5hbWU6ICdjb3JlX3Byb2ZpbGVfY2RrJyxcbiAgICB9LFxuICAgIHJlc3VsdENvbmZpZ3VyYXRpb246IHtcbiAgICAgIGVuY3J5cHRpb25Db25maWd1cmF0aW9uOiB7XG4gICAgICAgIGVuY3J5cHRpb25PcHRpb246IHRhc2tzLkVuY3J5cHRpb25PcHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIH0sXG4gICAgICBvdXRwdXRMb2NhdGlvbjoge1xuICAgICAgICBidWNrZXROYW1lOiAnY29yZV9wcm9maWxlX2NkaycsXG4gICAgICBvYmplY3RLZXk6ICdiaWxsaW5nX3JlcXVpcmVtZW50JyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBpbnRlZ3JhdGlvblBhdHRlcm46IHNmbi5JbnRlZ3JhdGlvblBhdHRlcm4uUlVOX0pPQixcbiAgICB9KTtcblxuLy8gY3Jhd2xlciBkZWZpbml0aW9uXG4gICAgY29uc3QgY3Jhd2xlcl90ZXN0X2NkayA9IG5ldyBnbHVlLkNmbkNyYXdsZXIodGhpcywgJ2NyYXdsZXJfdGVzdF9jZGtfZm9yX3NucycsIHtcbiAgICAgIHJvbGU6ICdhcm46YXdzOmlhbTo6NDY0MzQwMzM5NDk3OnJvbGUvc2VydmljZS1yb2xlL0FXU0dsdWVTZXJ2aWNlUm9sZS1EYXRhbGFrZScsXG4gICAgICB0YXJnZXRzOiB7XG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIHBhdGggdG8gc291cmNlIGRhdGEgaW4gY29yZSBwcm9maWxlIGRldiBhY2NvdW50XG4gICAgICAgIHMzVGFyZ2V0czogW3tcbiAgICAgICAgICBwYXRoOiAnczM6Ly9zby8nXG4gICAgICAgIH1dLFxuICAgICAgfSxcbiAgICAgIGRhdGFiYXNlTmFtZTogJ2NvcmVfcHJvZmlsZV9jZGsnLFxuICAgICAgZGVzY3JpcHRpb246ICdUaGlzIGlzIHRoZSBjcmF3bGVyIHRvIHJlYWQgdGhlIHNjaGVtYSBvZiB0aGUgc291cmNlIGRhdGEgZnJvbSBjb3JlIHByb2ZpbGUgZGV2IGFjY291bnQnLFxuICAgICAgLy8gTm90ZTogVGhpcyBpcyB0aGUgbmFtZSBvZiB0aGUgY3Jhd2xlciB0aGF0IGlzIGNyZWF0ZWQgaW4gQVdTIGNvbnNvbGVcbiAgICAgIG5hbWU6ICdjcmF3bGVyX3Rlc3RfY2RrX2Zvcl9zbnMnLFxuICAgICAgLy8gVE8gRE9cbiAgICAgIC8vIHNjaGVkdWxlOiB7XG4gICAgICAvLyAgIHNjaGVkdWxlRXhwcmVzc2lvbjogJ3NjaGVkdWxlRXhwcmVzc2lvbicsXG4gICAgICAvLyB9LFxuICAgICAgc2NoZW1hQ2hhbmdlUG9saWN5OiB7XG4gICAgICAgIGRlbGV0ZUJlaGF2aW9yOiAnTE9HJyxcbiAgICAgICAgdXBkYXRlQmVoYXZpb3I6ICdVUERBVEVfSU5fREFUQUJBU0UnLFxuICAgICAgfSxcbiAgICAgIHRhYmxlUHJlZml4OiAnc291cmNlXydcbiAgICB9KTtcblxuICAgIGNvbnN0IGNyYXdsZXJfbGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnbGFtYmRhX2NyYXdsZXJfc25zJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfNywgLy9leGVjdXRpb24gZW52aXJvbWVudFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwibGFtYmRhXCIpLCAgLy9kaXJlY3RvcnkgdXNlZCBmcm9tIHdoZXJlIGNvZGUgaXMgbG9hZGVkXG4gICAgICBoYW5kbGVyOiAnbGFtYmRhX2NyYXdsZXJfc25zLmxhbWJkYV9oYW5kbGVyJywgLy9uYW1lIG9mIGZpbGUuZnVuY3Rpb24gaXMgbGFtYmRhX2hhbmRsZXIgaW4gdGhlIGNvZGUgZm9yIGxhbWJkYVxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLFxuICAgICAgICB9KTtcbiAgICBcbiAgLy8gY3JlYXRlIGEgcG9saWN5XG4gICAgY29uc3QgcGVybWlzc2lvbnNfdG9fZ2x1ZV9jcmF3bGVyX2xhbWJkYSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZ2x1ZToqJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pO1xuXG4gICAgLy8gYWRkIHRoZSBwb2xpY3kgdG8gdGhlIEZ1bmN0aW9uJ3Mgcm9sZVxuICAgXG4gICAgY3Jhd2xlcl9sYW1iZGEucm9sZT8uYXR0YWNoSW5saW5lUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3kodGhpcywgJ2dsdWUgY3Jhd2xlciBzb3VyY2UgZGF0YSBjcm9zcyBhY2NvdW50Jywge1xuICAgICAgICBzdGF0ZW1lbnRzOiBbcGVybWlzc2lvbnNfdG9fZ2x1ZV9jcmF3bGVyX2xhbWJkYV0sXG4gICAgICB9KSxcbiAgICApO1xuICAgIFxuICAgIGNvbnN0IHNuc19jcmF3bGVyID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnQ3Jhd2xlciBMYW1iZGEgU05TJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IGNyYXdsZXJfbGFtYmRhLFxuICAgICAgLy8gTGFtYmRhJ3MgcmVzdWx0IGlzIGluIHRoZSBhdHRyaWJ1dGUgYFBheWxvYWRgXG4gICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJyxcbiAgICAgICAgfSk7XG4vLyBDcmVhdGUgU05TIHRvcGljIFxuXG4gICAgY29uc3QgdG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdUb3BpYycsIHtcbiAgICAgIGRpc3BsYXlOYW1lOiAndGVzdGluZyBzbnMgbm90aWZpY2F0aW9ucyB1c2luZyBjZGsnLFxuICAgIH0pO1xuXG4vLyBDcmVhdGUgc3Vic2NyaXB0aW9uXG4gICAgdG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKCdoaW1hbnNodS5hZ2dhcndhbF9leHRAbWljaGVsaW4uY29tJykpO1xuICAgIHRvcGljLmFkZFN1YnNjcmlwdGlvbihuZXcgc3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbignaGltYW5zaHVhZ2cxOTkxQGdtYWlsLmNvbScpKTtcblxuLy8vLy9cbiAgICBjb25zdCBkZWZpbml0aW9uID0gc25zX2NyYXdsZXJcbiAgICAubmV4dChzdGFydFF1ZXJ5RXhlY3V0aW9uSm9iX2NyZWF0ZV90YWJsZV9iaWxsaW5nX3JlcXVpcmVtZW50KVxuXG4gICAgY29uc3Qgc3RhdGVfbWFjaGluZSA9IG5ldyBzZm4uU3RhdGVNYWNoaW5lKHRoaXMsICd0ZXN0X3NucycsIHtcbiAgICAgIGRlZmluaXRpb25cbiAgICB9KTtcblxuICAgIC8vIHNldCB0aGUgcnVsZSBob3cgdGhlIG5vdGlmaWNhdGlvbnMgYXJlIHNlbnQgXG4gICAgLy8gSGVyZSBpbiB0aGUgcnVsZSB3ZSBzcGVjaWZ5IHdoaWNoIEFXUyByZXNvdXJjZSB0aGF0IHdpbGwgYmUgY2hlY2tlZCBmb3IgdGhlIHN0YXR1c2VzIG1lbnRpb25lZCBpbiB0aGUgZXZlbnQgcGF0dGVyblxuICAgIGNvbnN0IHJ1bGUxID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdzdGVwZnVuY3Rpb25zIHJ1bGUnLCB7XG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICBcInNvdXJjZVwiOiBbXCJhd3Muc3RhdGVzXCJdLFxuICAgICAgIFwiZGV0YWlsXCI6IHtcbiAgICAgICBcInN0YXR1c1wiOiBbXCJGQUlMRURcIiwgXCJUSU1FRF9PVVRcIiwgXCJBQk9SVEVEXCJdLCBcbiAgICAgICBcInN0YXRlTWFjaGluZUFyblwiOiBbYCR7c3RhdGVfbWFjaGluZS5zdGF0ZU1hY2hpbmVBcm59YF1cbiAgfVxuICAgICAgfSxcbiAgICB9KTtcblxuLy8gQWRkIGEgdGFyZ2V0IHRvIHRoZSBydWxlIGNyZWF0ZWQgXG5cbiAgICBydWxlMS5hZGRUYXJnZXQobmV3IHRhcmdldHMuU25zVG9waWModG9waWMgLCB7XG4gICAgICAvLyBjaGVjayBob3cgd2UgY2FuIHNldCB0aGUgcHJvcCByZXRyeUF0dGVtcHRzXG4gICAgfSkpO1xuXG5cbiAgICAvLy8vLy8vIGNoZWNrIFNOUyB3aXRoIGdsdWUgY3Jhd2xlciAtXG4gICAgLy8gUnVsZSBmb3IgdGhlIGNyYXdsZXJcbiAgICBjb25zdCBydWxlMiA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnZ2x1ZSBjcmF3bGVyIHJ1bGUnLCB7XG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgXCJzb3VyY2VcIjogW1wiYXdzLmdsdWVcIl0sXG4gICAgICAgIFwiYWNjb3VudFwiOiBbXCI0NjQzNDAzMzk0OTdcIl0sXG4gICAgICAgIFwicmVnaW9uXCI6IFtcInVzLWVhc3QtMVwiXSxcbiAgICAgICAgXCJkZXRhaWxcIjoge1xuICAgICAgICAgIFwiY3Jhd2xlck5hbWVcIjogW1wiY3Jhd2xlcl90ZXN0X2Nka19mb3Jfc25zXCJdLFxuICAgICAgICAgIFwic3RhdGVcIjogW1wiRmFpbGVkXCJdLFxuICAgICAgICAgIFwibWVzc2FnZVwiOiBbXCJDcmF3bGVyIEZhaWxlZFwiXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHJ1bGUyLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5TbnNUb3BpYyh0b3BpYyAsIHtcbiAgICAgIC8vIGNoZWNrIGhvdyB3ZSBjYW4gc2V0IHRoZSBwcm9wIHJldHJ5QXR0ZW1wdHNcbiAgICB9KSk7XG5cbiAgfVxufVxuXG4iXX0=