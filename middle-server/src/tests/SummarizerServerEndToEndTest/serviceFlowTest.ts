import { fetchTodoLogic } from "../../controllers/summarizer/worker/fetchTodo";
import { DocumentationStatus } from "../../models/Documentation";
import { DocumentationModel } from "../../models/Documentation";
import { checkToDoAssignment } from "../../controllers/summarizer/worker/checkTodo";
import { addPRUrlLogic } from "../../controllers/summarizer/worker/addTodoPR";
import { addStatusLogic } from "../../controllers/summarizer/worker/addTodoStatus";
// import { SwarmBountyStatus } from "../../config/constant";
import { updateAssignedInfoRoundNumber } from "../../controllers/summarizer/worker/addRoundNumber";
import { updateSubtaskStatus } from "../../services/summarizer/fetchDistribution";
import dotenv from "dotenv";
dotenv.config();
interface UserData {
  signature: string;
  stakingKey: string;
  githubUsername: string;
  prUrl?: string;
  swarmBountyId?: string;
  submissionRoundNumber?: number;
}

interface DocsTaskData {
  swarmBountyId: string;
  repoOwner: string;
  repoName: string;
}
const usedTaskData: DocsTaskData[] = [];
const usedUserData: UserData[] = [];
async function addDummyData() {
  const swarmBountyId = "fakeSwarmBountyId" + Math.random().toString(36).substring(2, 15);
  const repoOwner = "fakeRepoOwner" + Math.random().toString(36).substring(2, 15);
  const repoName = "fakeRepoName" + Math.random().toString(36).substring(2, 15);

  await DocumentationModel.create({
    repoOwner: repoOwner, // Extract owner from GitHub URL
    repoName: repoName, // Extract repo name from GitHub URL
    swarmBountyId: swarmBountyId,
  });
  usedTaskData.push({ swarmBountyId: swarmBountyId, repoOwner: repoOwner, repoName: repoName });
}
async function cleanup() {
  // delete all swarmBountyId in usedTaskData
  for (const task of usedTaskData) {
    await DocumentationModel.deleteOne({ swarmBountyId: task.swarmBountyId });
  }
}

async function dummyFetchTodo() {
  const signature = "fakeSignature" + Math.random().toString(36).substring(2, 15);
  const stakingKey = "fakeStakingKey" + Math.random().toString(36).substring(2, 15);
  const githubUsername = "fakeGithubUsername" + Math.random().toString(36).substring(2, 15);
  usedUserData.push({ signature: signature, stakingKey: stakingKey, githubUsername: githubUsername });
  const response = await fetchTodoLogic(
    { signature: signature, stakingKey: stakingKey },
    { githubUsername: githubUsername },
  );
  return response;
}
async function dummyAddTodoPR(signature: string, stakingKey: string, swarmBountyId: string) {
  const prUrl = "fakePrUrl" + Math.random().toString(36).substring(2, 15);
  // Find this staking key in usedUserData
  const userData = usedUserData.find((user) => user.stakingKey === stakingKey);
  if (!userData) {
    throw new Error("Staking key not found");
  }
  userData.prUrl = prUrl;
  const response = await addPRUrlLogic(
    { signature: signature, stakingKey: stakingKey },
    { prUrl: prUrl, swarmBountyId: swarmBountyId },
  );
  return response;
}
async function dummyAddTodoStatus(signature: string, stakingKey: string, swarmBountyId: string) {
  const response = await addStatusLogic(
    { signature: signature, stakingKey: stakingKey },
    { SwarmBountyId: swarmBountyId },
  );
  return response;
}
async function dummyCheckTodo(stakingKey: string, roundNumber: string, githubUsername: string, prUrl: string) {
  const response = await checkToDoAssignment(stakingKey, roundNumber, githubUsername, prUrl);
  return response;
}
async function dummyAddRoundNumber(
  signature: string,
  stakingKey: string,
  prUrl: string,
  roundNumber: number,
  swarmBountyId: string,
) {
  const response = await updateAssignedInfoRoundNumber(stakingKey, prUrl, signature, roundNumber, swarmBountyId);
  return response;
}
async function main() {
  try {
    for (let i = 0; i < 10; i++) {
      await addDummyData();
      const response = await dummyFetchTodo();
      if (response.statuscode !== 200) {
        console.log(response);
        throw new Error("Failed to fetch todo");
      }
    }
    // 8 of them added pr url
    for (let i = 0; i < 8; i++) {
      const response = await dummyAddTodoPR(
        usedUserData[i].signature,
        usedUserData[i].stakingKey,
        usedTaskData[i].swarmBountyId,
      );

      if (response.statuscode !== 200) {
        console.log(response);
        throw new Error("Failed to add todo pr");
      }
    }
    // 2 of them failed and add failed status
    for (let i = 8; i < 10; i++) {
      const response = await dummyAddTodoStatus(
        usedUserData[i].signature,
        usedUserData[i].stakingKey,
        usedTaskData[i].swarmBountyId,
      );
      if (response.statuscode !== 200) {
        console.log(response);
        throw new Error("Failed to add todo status");
      }
    }

    // 3 of them added round number 1
    for (let i = 0; i < 3; i++) {
      const response = await dummyAddRoundNumber(
        usedUserData[i].signature,
        usedUserData[i].stakingKey,
        usedUserData[i].prUrl!,
        1,
        usedTaskData[i].swarmBountyId,
      );
      if (response.statuscode !== 200) {
        console.log(response);
        throw new Error("Failed to add round number");
      }
    }
    // 5 of them added round number 2
    for (let i = 3; i < 8; i++) {
      if (!usedUserData[i].prUrl) {
        throw new Error("Pr url is undefined");
      }
      const response = await dummyAddRoundNumber(
        usedUserData[i].signature,
        usedUserData[i].stakingKey,
        usedUserData[i].prUrl!,
        2,
        usedTaskData[i].swarmBountyId,
      );
      if (response.statuscode !== 200) {
        console.log(response);
        throw new Error("Failed to add round number");
      }
    }
    for (let i = 0; i < 3; i++) {
      if (!usedUserData[i].prUrl) {
        throw new Error("Pr url is undefined");
      }
      const response = await dummyCheckTodo(
        usedUserData[i].stakingKey,
        "1",
        usedUserData[i].githubUsername,
        usedUserData[i].prUrl!,
      );
      if (response !== true) {
        console.log(response);
        throw new Error("Failed to check todo");
      }
    }
    for (let i = 0; i < 3; i++) {
      if (!usedUserData[i].prUrl) {
        throw new Error("Pr url is undefined");
      }
      const response = await dummyCheckTodo(
        usedUserData[i].stakingKey,
        "2",
        usedUserData[i].githubUsername,
        usedUserData[i].prUrl!,
      );
      if (response !== false) {
        console.log(response);
        throw new Error("Check todo should return false");
      }
    }
    for (let i = 3; i < 8; i++) {
      if (!usedUserData[i].prUrl) {
        throw new Error("Pr url is undefined");
      }
      const response = await dummyCheckTodo(
        usedUserData[i].stakingKey,
        "2",
        usedUserData[i].githubUsername,
        usedUserData[i].prUrl!,
      );
      if (response !== true) {
        console.log(response);
        throw new Error("Failed to check todo");
      }
    }
    for (let i = 3; i < 8; i++) {
      if (!usedUserData[i].prUrl) {
        throw new Error("Pr url is undefined");
      }
      const response = await dummyCheckTodo(
        usedUserData[i].stakingKey,
        "1",
        usedUserData[i].githubUsername,
        usedUserData[i].prUrl!,
      );
      if (response !== false) {
        console.log(response);
        throw new Error("Check todo should return false");
      }
    }
    const positiveKeys: string[] = [];
    const negativeKeys: string[] = [];
    // 0, 1 should be positive,
    for (let i = 0; i < 2; i++) {
      positiveKeys.push(usedUserData[i].stakingKey);
    }
    // 2, should be negative
    negativeKeys.push(usedUserData[2].stakingKey);
    // 3, 4, 5, 6 can be positive, but they cannot be marked as done
    for (let i = 3; i < 7; i++) {
      positiveKeys.push(usedUserData[i].stakingKey);
    }
    await updateSubtaskStatus(positiveKeys, negativeKeys, 1);

    // Expect result:
    // 0, 1 should be done,
    for (let i = 0; i < 2; i++) {
      const result = await DocumentationModel.findOne({ stakingKey: usedUserData[i].stakingKey });
      if (result?.status !== DocumentationStatus.DONE) {
        console.log(result);
        throw new Error("0, 1 should be done");
      }
    }
    // 2 should be failed
    const result = await DocumentationModel.findOne({ stakingKey: usedUserData[2].stakingKey });
    if (result?.status !== DocumentationStatus.INITIALIZED) {
      console.log(result);
      throw new Error("2 should be failed");
    }
    // 3, 4, 5, 6 should be in review
    for (let i = 3; i < 7; i++) {
      const result = await DocumentationModel.findOne({ stakingKey: usedUserData[i].stakingKey });
      if (result?.status !== DocumentationStatus.IN_REVIEW) {
        console.log(result);
        throw new Error("3, 4, 5, 6 should be in review");
      }
    }

    const positiveKeys2: string[] = [];
    const negativeKeys2: string[] = [];
    // Even if the 0, 1 are negative, they should be marked as done
    for (let i = 0; i < 2; i++) {
      negativeKeys2.push(usedUserData[i].stakingKey);
    }
    // 3, 4, 5, 6 should be positive
    for (let i = 3; i < 7; i++) {
      positiveKeys2.push(usedUserData[i].stakingKey);
    }
    // 7 should be negative
    negativeKeys2.push(usedUserData[7].stakingKey);
    await updateSubtaskStatus(positiveKeys2, negativeKeys2, 2);

    // Expect result:
    // 0, 1 should be done,
    for (let i = 0; i < 2; i++) {
      const result = await DocumentationModel.findOne({ stakingKey: usedUserData[i].stakingKey });
      if (result?.status !== DocumentationStatus.DONE) {
        console.log(result);
        throw new Error("0, 1 should be done");
      }
    }
    // 2 should be failed
    const result2 = await DocumentationModel.findOne({ stakingKey: usedUserData[2].stakingKey });
    if (result2?.status !== DocumentationStatus.INITIALIZED) {
      console.log(result2);
      throw new Error("2 should be failed");
    }
    // 3, 4, 5 should be done
    for (let i = 3; i < 7; i++) {
      const result = await DocumentationModel.findOne({ stakingKey: usedUserData[i].stakingKey });
      if (result?.status !== DocumentationStatus.DONE) {
        console.log(result);
        throw new Error("3, 4, 5, 6 should be done");
      }
    }
    // 7 should be initialized
    const result3 = await DocumentationModel.findOne({ stakingKey: usedUserData[7].stakingKey });
    if (result3?.status !== DocumentationStatus.INITIALIZED) {
      console.log(result3);
      throw new Error("7 should be initialized");
    }
    // 8, 9 should be initialized
    for (let i = 8; i < 10; i++) {
      console.log("USER", i, usedTaskData[i].swarmBountyId);
      const result = await DocumentationModel.findOne({ swarmBountyId: usedTaskData[i].swarmBountyId });
      if (result?.status !== DocumentationStatus.INITIALIZED) {
        console.log(result);
        throw new Error("8, 9 should be initialized");
      }
    }
    console.log("TEST PASSED");
  } catch (error) {
    console.error("Test failed with error:", error);
    throw error;
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
