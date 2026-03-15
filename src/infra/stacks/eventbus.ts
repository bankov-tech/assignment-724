import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { CloudWatchLogGroup } from "aws-cdk-lib/aws-events-targets";

export interface EventBusProps extends StackProps {
  stage: string;
}
export class EventBusStack extends Stack {
  public readonly eventBus: EventBus;

  constructor(scope: Construct, id: string, props: EventBusProps) {
    super(scope, id, props);

    this.eventBus = new EventBus(this, "PersonsEventBus", {
      eventBusName: `persons-${props.stage}`
    });

    const logGroup = new LogGroup(this, "PersonsEventBusLogs", {
      logGroupName: `/aws/events/persons-${props.stage}`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy:
        props.stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    });

    new Rule(this, "PersonsEventBusLogRule", {
      eventBus: this.eventBus,
      eventPattern: {
        account: [this.account]
      },
      targets: [new CloudWatchLogGroup(logGroup)]
    });
  }
}
