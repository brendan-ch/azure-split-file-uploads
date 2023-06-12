// @ts-check

import dotenv from 'dotenv'
import readline from 'readline'
import fs from 'fs'
import { ShareFileClient, ShareServiceClient } from '@azure/storage-file-share'

// Range size in bytes for the file
const RANGE_SIZE = 4194304

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

/**
 * Initialize the connection to Azure storage and create a file.
 * @param {string} localPath The local file path on the system.
 * @returns {Promise<ShareFileClient>}
 */
async function createFile(localPath) {
  // Attempt to read the file from disk
  const file = fs.readFileSync(localPath)
  // Get the size
  const size = file.byteLength

  // Connect to Azure and create the partial file
  const connectionString = process.env.CONNECTION_STRING
  if (!connectionString) {
    throw new Error('No connection string provided.')
  }

  const serviceClient = ShareServiceClient.fromConnectionString(connectionString)
  const shareClient = serviceClient.getShareClient('test-file-share')

  const directoryClient = shareClient.getDirectoryClient('test-folder')

  const { fileClient } = await directoryClient.createFile('test-file.pdf', size, {
  })

  return fileClient
}

/**
 * Completely upload a local file in partial fragments.
 * @param {ShareFileClient} fileClient
 * @param {string} localPath
 */
async function partialUpload(fileClient, localPath) {
  const file = fs.readFileSync(localPath)
  let offset = 0;

  let md5 = undefined;
  
  // TO-DO: make this a timer
  // Don't do this (async + for/while loops) in production
  while (offset < file.byteLength) {
    const subarray = file.subarray(offset, offset + RANGE_SIZE)
    console.log(`Uploading subarray starting from offset ${offset}`)
    console.log(subarray);
    
    // Upload to the file client
    const response = await fileClient.uploadRange(subarray, offset, RANGE_SIZE, {
      contentMD5: md5,
      fileLastWrittenMode: 'Preserve'
    })
    md5 = response.contentMD5

    offset += RANGE_SIZE
  }

  console.log('Upload complete')
}

// Wait for the user to enter a path
const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

let localPath = '';

terminal.question('Enter the path to the test file: ', answer => {
  localPath = answer
  createFile(localPath)
    .then((fileClient) => partialUpload(fileClient, localPath))
})

