// @ts-check

import dotenv from 'dotenv'
import readline from 'readline'
import fs from 'fs'
import {
  ShareFileClient,
  ShareServiceClient,
  StorageSharedKeyCredential,
  generateAccountSASQueryParameters,
  AccountSASPermissions,
  AccountSASServices,
  AccountSASResourceTypes,
} from '@azure/storage-file-share'

// Range size in bytes for the file
const RANGE_SIZE = 4194304

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const sharedKeyCredential = new StorageSharedKeyCredential(
  process.env.ACCOUNT_NAME ? process.env.ACCOUNT_NAME : '',
  process.env.ACCOUNT_KEY ? process.env.ACCOUNT_KEY : '',
)

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

  const permissions = new AccountSASPermissions()
  permissions.add = true
  permissions.create = true
  permissions.delete = true
  permissions.list = true
  permissions.process = true
  permissions.read = true
  permissions.update = true
  permissions.write = true

  const resources = new AccountSASResourceTypes()
  resources.container = true
  resources.object = true
  resources.service = true

  const services = new AccountSASServices()
  services.file = true

  const result = generateAccountSASQueryParameters({
    // one hour
    expiresOn: new Date(Date.now() + 3600000),
    permissions: permissions,
    resourceTypes: resources.toString(),
    services: services.toString()
  }, sharedKeyCredential)

  const sas = result.toString()

  // const serviceClient = ShareServiceClient.fromConnectionString(connectionString)
  const serviceClient = new ShareServiceClient(`https://${process.env.ACCOUNT_NAME}.file.core.windows.net?${sas}`)
  const shareClient = serviceClient.getShareClient('test-file-share')

  const directoryClient = shareClient.getDirectoryClient('test-folder')

  const { fileClient } = await directoryClient.createFile('test-file.pdf', size, {
  })

  console.log('File created')

  return fileClient
}

/**
 * Completely upload a local file in partial fragments.
 * @param {ShareFileClient} fileClient
 * @param {string} localPath
 */
async function partialUpload(fileClient, localPath) {
  const file = fs.readFileSync(localPath)
  const totalSize = file.byteLength;
  let offset = 0;

  // TO-DO: make this a timer
  // Don't do this (async + for/while loops) in production
  while (offset < file.byteLength) {
    const subarray = file.subarray(offset, offset + RANGE_SIZE - 1)
    console.log(`Uploading subarray starting from offset ${offset}`)
    console.log(subarray);

    // Upload to the file client
    const response = await fileClient.uploadRange(subarray, offset, offset + RANGE_SIZE - 1 > totalSize ? totalSize - offset : RANGE_SIZE - 1, {
    })

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
    .then(() => terminal.close())
})

