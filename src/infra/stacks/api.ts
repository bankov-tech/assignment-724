import path from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import {
  Effect as IAMPolicyStatementEffect,
  ManagedPolicy as IAMManagedPolicy,
  PolicyDocument as IAMPolicyDocument,
  PolicyStatement as IAMPolicyStatement,
  Role as IAMRole,
  ServicePrincipal as IAMServicePrincipal
} from "aws-cdk-lib/aws-iam";
import { Runtime as LambdaRuntime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { TableV2 as DynamoDBTable } from "aws-cdk-lib/aws-dynamodb";
import { EventBus } from "aws-cdk-lib/aws-events";

export interface APIProps extends StackProps {
  stage: string;
  personsTable: DynamoDBTable;
  eventBus: EventBus;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: APIProps) {
    super(scope, id, props);

    // Lambda resources
    const createPersonIAMRole = new IAMRole(this, `CreatePersonIAMRole`, {
      assumedBy: new IAMServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        CreatePersonPolicy: new IAMPolicyDocument({
          statements: [
            new IAMPolicyStatement({
              actions: ["dynamodb:PutItem"],
              effect: IAMPolicyStatementEffect.ALLOW,
              resources: [props.personsTable.tableArn]
            })
          ]
        })
      },
      managedPolicies: [
        IAMManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        )
      ]
    });

    const createPersonFunction = new NodejsFunction(
      this,
      `CreatePersonFunction`,
      {
        description: "Creates a person in DynamoDB",
        runtime: LambdaRuntime.NODEJS_LATEST,
        entry: path.join(
          __dirname,
          "../../../src/functions/createPerson/index.ts"
        ),
        handler: "createPerson",
        timeout: Duration.seconds(10),
        role: createPersonIAMRole,
        environment: {
          PERSONS_TABLE_NAME: props.personsTable.tableName,
          PERSONS_EVENT_BUS_NAME: props.eventBus.eventBusName
        }
      }
    );

    props.eventBus.grantPutEventsTo(createPersonFunction);

    new LogGroup(this, "CreatePersonFunctionLogGroup", {
      logGroupName: `/aws/lambda/${createPersonFunction.functionName}`,
      retention:
        props.stage === "prod"
          ? RetentionDays.ONE_YEAR
          : RetentionDays.ONE_MONTH,
      removalPolicy:
        props.stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    });

    // API resource
    const api = new HttpApi(this, `PersonsAPI`, {
      createDefaultStage: false,
      corsPreflight: {
        allowHeaders: ["application/json"],
        allowMethods: [CorsHttpMethod.POST],
        allowOrigins: ["*"]
      }
    });

    api.addStage(`v1`, {
      stageName: "v1",
      autoDeploy: true
    });

    api.addRoutes({
      methods: [HttpMethod.POST],
      path: "/person",
      integration: new HttpLambdaIntegration(
        "CreatePersonIntegration",
        createPersonFunction
      )
    });

    // Lambda permissions
    createPersonFunction.grantInvoke(
      new IAMServicePrincipal("apigateway.amazonaws.com", {
        conditions: {
          ArnLike: {
            "aws:SourceArn": `arn:aws:execute-api:${this.region}:${this.account}:${api.apiId}/*/*`
          }
        }
      })
    );

    new CfnOutput(this, "APIBaseURL", {
      key: "APIBaseURL",
      value: api.apiEndpoint
    });
  }
}
