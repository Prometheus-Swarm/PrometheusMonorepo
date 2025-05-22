import { namespaceWrapper } from "@_koii/namespace-wrapper";
import { Keypair, PublicKey } from "@_koii/web3.js";
import { middleServerUrl } from "../constant";
import { TASK_ID } from "@_koii/namespace-wrapper";
async function createRequestBody(signatureField:any, extraField:any={}) {

    const stakingKeypair = await namespaceWrapper.getSubmitterAccount();
    if (!stakingKeypair) {
        throw new Error("Staking keypair not found");
    }
    const pubKey = await namespaceWrapper.getMainAccountPubkey();
    if (!pubKey) {
        throw new Error("Pubkey not found");
    }

    const signature = await namespaceWrapper.payloadSigning(signatureField);
    
    const requestBody = {
        signature: signature,
        stakingKey: stakingKeypair.publicKey.toBase58(),
        pubKey: pubKey,
        ...extraField
    }

    return requestBody;

}
async function  generateDefaultSignatureInfo(extraField:any) {
    const pubKey = await namespaceWrapper.getMainAccountPubkey();
    const stakingKey = await namespaceWrapper.getSubmitterAccount();
    const stakingKeyBase58 = stakingKey?.publicKey.toBase58();
    const signatureField = {
        ...extraField,
        "taskId": TASK_ID,
        "githubUsername": process.env.GITHUB_USERNAME,
        "pubKey": pubKey,
        "stakingKey": stakingKeyBase58
    }
    return signatureField;
}
type ErrorResponse = {
    success: false;
    message: string;
  }
  
type SuccessResponse = {
    success: true;
    data: {
      repo_owner: string;
      repo_name: string;
      issue_uuid: string;
      pr_list: Record<string, any>; // or more specific PR type if known
      bounty_id: string;
      fork_owner: string;
      aggregator_owner?: string; // optional as it's only present in some responses
    }
}
type FetchIssueResponse = ErrorResponse | SuccessResponse;

type AggregatorInfoResponse = {
    success: boolean;
    message: string;
    todosUpdated?: number;
  }


type CheckIssueResponse = {
    success: boolean;
    message: string;
    data?: {
        pr_list: any;
        issue_uuid: string;
        system_prompt: string | undefined;
    }
}


type AssignIssueResponse = {
    success: true;
    message: string;
    issueId: string;
    repoOwner: string;
    repoName: string;
    bountyId: string;
    forkUrl: string;
  } | {
    success: false;
    message: string;
}

type AddIssuePRResponse = {
    success: false,
    message: string
  }
async function fetchIssue(): Promise<FetchIssueResponse | null> {

    try {
        const roundNumber = await namespaceWrapper.getRound();
        const signatureField = await generateDefaultSignatureInfo({action: "fetch-issue", roundNumber: roundNumber});
        const requestBody = await createRequestBody(signatureField);
        const response = await fetch(`${middleServerUrl}/summarizer/worker/fetch-issue`, {
            method: "POST",
            body: JSON.stringify(requestBody),
        });
    
        if (!response.ok) {
            throw new Error("Failed to fetch issue");
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function addAggregatorInfo({roundNumber, issueUuid, aggregatorUrl}:{roundNumber: number, issueUuid: string, aggregatorUrl: string}): Promise<AggregatorInfoResponse | null> {
try {
    const signatureField = await generateDefaultSignatureInfo({action: "create-repo", roundNumber: roundNumber, aggregatorUrl: aggregatorUrl, issueUuid: issueUuid});
    const requestBody = await createRequestBody(signatureField);
    const response = await fetch(`${middleServerUrl}/summarizer/worker/add-aggregator-info`, {
        method: "POST",
        body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
        throw new Error("Failed to add aggregator info");
    }

    const data = await response.json();
    return data;
} catch (error) {
    console.error(error);
    return null;
}
}



async function addIssuePR({roundNumber, issueUuid, prUrl, isFinal}:{roundNumber: number, issueUuid: string, prUrl: string, isFinal: boolean}): Promise<AddIssuePRResponse | null> {
    try {
        const signatureField = await generateDefaultSignatureInfo({action: "add-issue-pr", roundNumber: roundNumber, prUrl: prUrl, isFinal: isFinal});
        const extraField = {
            "issueUuid": issueUuid,
        "isFinal": isFinal,
        "prUrl": prUrl
    }
        const requestBody = await createRequestBody(signatureField, extraField);
        const response = await fetch(`${middleServerUrl}/summarizer/worker/add-issue-pr`, {
            method: "POST",
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) { 
            throw new Error("Failed to add issue PR");
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}   



async function checkIssue({roundNumber, issueUuid, prUrl, bountyId}:{roundNumber: number, issueUuid: string, prUrl: string, bountyId: string}): Promise<CheckIssueResponse | null> {
// /summarizer/worker/check-issue
    try {
        const signatureField = await generateDefaultSignatureInfo({action: "audit", roundNumber: roundNumber, issueUuid: issueUuid, prUrl: prUrl, bountyId: bountyId});
        const requestBody = await createRequestBody(signatureField);
        const response = await fetch(`${middleServerUrl}/summarizer/worker/check-issue`, {
            method: "POST",
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error("Failed to check issue");
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function assignIssue(): Promise<AssignIssueResponse | null> {
    // /summarizer/worker/assign-issue
    try{
        const body = {githubUsername: process.env.GITHUB_USERNAME};
        const response = await fetch(`${middleServerUrl}/summarizer/worker/assign-issue`, {
            method: "POST",
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error("Failed to assign issue");
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}




export { fetchIssue, addAggregatorInfo, addIssuePR, checkIssue, assignIssue };