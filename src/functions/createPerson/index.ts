import { randomUUID } from "node:crypto";
import type { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { Person } from "../models/person";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

interface CreatePersonResult {
  id: string;
}

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});

const makeApiResponse = (
  statusCode: number,
  body: CreatePersonResult | { error: any }
): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

const putPersonInDynamoDB = async (
  tableName: string,
  person: Person
): Promise<CreatePersonResult> => {
  const id = randomUUID();

  console.log(`Putting person in DynamoDB: ${JSON.stringify(person, null, 2)}`);

  const putCommand = new PutCommand({
    TableName: tableName,
    Item: { ...person, id }
  });

  const response = await docClient.send(putCommand);
  console.log(`DynamoDB response: ${JSON.stringify(response, null, 2)}`);

  return { id };
};

const sendEventToEventbridge = async (
  busName: string,
  eventType: string,
  payload: any
): Promise<void> => {
  console.log(`Sending ${eventType} to EventBridge with payload: ${payload}`);

  const putEventsCommand = new PutEventsCommand({
    Entries: [
      {
        Source: "persons-service",
        DetailType: eventType,
        Detail: JSON.stringify(payload),
        EventBusName: busName
      }
    ]
  });

  const response = await eventBridgeClient.send(putEventsCommand);
  console.log(`EventBridge response: ${JSON.stringify(response, null, 2)}`);
};

export const createPerson = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  if (!process.env["PERSONS_TABLE_NAME"])
    throw new Error("PERSONS_TABLE_NAME environment variable is not set");
  if (!process.env["PERSONS_EVENT_BUS_NAME"])
    throw new Error("PERSONS_EVENT_BUS_NAME environment variable is not set");

  const tableName = process.env["PERSONS_TABLE_NAME"];
  const busName = process.env["PERSONS_EVENT_BUS_NAME"];

  const request = Person.safeParse(JSON.parse(event.body ?? "{}"));
  if (!request.success)
    return makeApiResponse(400, {
      error: request.error.issues
    });

  const createPersonResult: CreatePersonResult = await putPersonInDynamoDB(
    tableName,
    request.data
  );

  await sendEventToEventbridge(busName, "person-created-event", {
    id: createPersonResult.id
  });

  return makeApiResponse(200, createPersonResult);
};
