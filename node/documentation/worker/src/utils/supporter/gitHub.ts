// Initialize Octokit with token
import dotenv from "dotenv";
import { middleServerUrl } from "../constant";
import { namespaceWrapper } from "@_koii/namespace-wrapper";
dotenv.config();

// Debug: Print all environment variables
// console.log('All environment variables:', process.env);

let octokit: any;

async function initializeOctokit() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GitHub token is not configured. Please set GITHUB_TOKEN in your .env file');
  }
  // console.log("token", process.env.GITHUB_TOKEN);
  // @ts-ignore
  const { Octokit } = await import("@octokit/rest");
  octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
}



async function createIssue(owner: string, repo: string, title: string, body: string) {
  if (!octokit) await initializeOctokit();
  try {
    const response = await octokit.rest.issues.create({
      owner: owner,
      repo: repo,
      title: title,
      body: body,
    });   
    // Check if status code is in the 2xx range (success)
    return response.data;
  } catch (error) {
    console.error("Error creating issue:", error);
    return null;
  }
}

async function starRepo(owner: string, repoName: string) : Promise<boolean> {
  if (!octokit) await initializeOctokit();
  try {
    console.log(`Attempting to star repo: ${owner}/${repoName}`);
    const response = await octokit.rest.activity.starRepoForAuthenticatedUser({
      owner: owner,
      repo: repoName,
    });
    console.log(`Star response status: ${response.status}`);
    return response.status >= 200 && response.status < 300;
  } catch (error: any) {
    console.log("Error details:", {
      message: error.message,
      status: error.status,
      request: error.request,
      response: error.response
    });
    return false;
  }
}
async function watchRepo(owner: string, repoName: string) : Promise<boolean> {
  if (!octokit) await initializeOctokit();
  const response = await octokit.activity.setRepoSubscription({
    owner: owner,
    repo: repoName,
    subscribed: true
  });
  return response.status >= 200 && response.status < 300;
}

async function checkWatched(owner: string, repoName: string) : Promise<boolean> {
  if (!octokit) await initializeOctokit();
  try {
    const response = await octokit.rest.activity.getRepoSubscription({
      owner: owner,
      repo: repoName,
    });
    return response.status >= 200 && response.status < 300;
  } catch (error: any) {
    console.log("Error checking if repo is watched:", error.message);
    return false;
  }
}
async function checkStarred(owner: string, repoName: string, username: string) {
  if (!octokit) await initializeOctokit();

  try {
    const response = await octokit.rest.activity.listReposStarredByUser({
      username: username,
      sort: 'created',
      per_page: 100,
    });
    // console.log("response", response);
    if (response.status != 200) {
      console.log("Error checking if user is starred", response);
      return true;
    }
    
    // Check if the target repo is in the list of starred repos
    const isStarred = response.data.some((repo: { owner: { login: string }, name: string }) => 
      repo.owner.login === owner && repo.name === repoName
    );
    // console.log("isStarred", isStarred);
    return isStarred;
  } catch (error) {
    console.log("error", error);
    return true;
  }
}

async function followUser(owner: string) : Promise<boolean> {
  if (!octokit) await initializeOctokit();
  try {
    const response = await octokit.rest.users.follow({
      username: owner,
    });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.log("error", error);
    return false;
  }
}

async function checkFollowed(username: string, owner: string) {
  if (!octokit) await initializeOctokit();
  try {
    const response = await octokit.rest.users.checkFollowingForUser({
      username: username,
      target_user: owner,
    });
    return response.status === 204; // GitHub returns 204 if following, 404 if not
  } catch (error: any) {
    console.log("Error checking if user is followed:", error.message);
    return false;
  }
}

async function checkRepoStatus(owner: string, repoName: string) {
  if (!octokit) await initializeOctokit();
  // Check if the repo exist and if it is public
  const response = await octokit.rest.repos.get({
    owner: owner,
    repo: repoName,
  });
  return response.status == 200;
}

async function getUserInfo() {
  if (!octokit) await initializeOctokit();
  try {
    const response = await octokit.rest.users.getAuthenticated();
    return {
      id: response.data.id,
      username: response.data.login
    };
  } catch (error) {
    console.error("Error getting user info:", error);
    return null;
  }
}

async function fetchStarTask(): Promise<{owner: string, repoName: string} | null> {
  try {
    const stakingKeypair = await namespaceWrapper.getSubmitterAccount();
    if (!stakingKeypair) {
      throw new Error("Staking keypair not found");
  }
  const jsonBody = {
    githubUsername: process.env.GITHUB_USERNAME,
  }
  const signature = await namespaceWrapper.payloadSigning(jsonBody, stakingKeypair.secretKey);
  console.log("signature", signature);
  console.log("stakingKeypair", stakingKeypair.publicKey.toBase58());
  console.log("middleServerUrl", middleServerUrl);
  const requiredWorkResponse = await fetch(`${middleServerUrl}/star/fetch-star`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ signature: signature, stakingKey: stakingKeypair.publicKey.toBase58() }),
  });
  console.log("requiredWorkResponse", requiredWorkResponse);
  if (requiredWorkResponse.status != 200) {
    throw new Error("Failed to fetch star task");
  }
  const data = await requiredWorkResponse.json();
  if (data.success) {
    return {
      owner: data.data.repo_owner,
      repoName: data.data.repo_name,
    };
  }
  return null;
  } catch (error) {
    console.error("Error fetching star task:", error);
    return null;
  }
}
async function triggerStarFlow() {
  if (!process.env.GITHUB_USERNAME) {
    throw new Error("GITHUB_USERNAME is not configured");
  }
  const task = await fetchStarTask();
  if (!task) {
    console.log("No star task available");
    return;
  }
  const { owner, repoName } = task;
  
  // First check if repo exists
  const repoExists = await checkRepoStatus(owner, repoName);
  if (!repoExists) {
    console.log(`Repository ${owner}/${repoName} does not exist or is not accessible`);
    return;
  }

  console.log("Checking if user is starred");
  const isStarred = await checkStarred(owner, repoName, process.env.GITHUB_USERNAME);
  console.log("isStarred - Returned value", isStarred);
  if (!isStarred) {
    console.log("Starring repo");
    const starResult = await starRepo(owner, repoName);
    if (!starResult) {
      console.log("Failed to star repo");
      return;
    }
  }

  console.log("Checking if user is followed");
  const isFollowed = await checkFollowed(process.env.GITHUB_USERNAME, owner);
  console.log("isFollowed - Returned value", isFollowed);
  if (!isFollowed) {
    console.log("Following user");
    const followResult = await followUser(owner);
    if (!followResult) {
      console.log("Failed to follow user");
      return;
    }
  }

  console.log("Checking if repo watched");
  const isWatched = await checkWatched(owner, repoName);
  console.log("isWatched - Returned value", isWatched);

  if (!isWatched) {
    console.log("Watching repo");
    const watchResult = await watchRepo(owner, repoName);
    if (!watchResult) {
      console.log("Failed to watch repo");
      return;
    }
  }

  console.log("Star flow completed successfully");
}

export { starRepo, createIssue, checkStarred, followUser, checkFollowed, checkRepoStatus, getUserInfo, triggerStarFlow };

// triggerStarFlow();