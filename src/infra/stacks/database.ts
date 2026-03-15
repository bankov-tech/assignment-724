import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

export interface DatabaseProps extends StackProps {
  stage: string;
}

export class DatabaseStack extends Stack {
  public readonly personsTable: TableV2;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id, props);

    this.personsTable = new TableV2(this, `PersonsTable`, {
      tableName: `persons-${props.stage}`,
      partitionKey: {
        name: "id",
        type: AttributeType.STRING
      },
      billing: Billing.onDemand(),
      deletionProtection: props.stage === "prod",
      removalPolicy:
        props.stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    });
  }
}
