"use client";

import Image from "next/image";
import Link from "next/link";
import type React from "react";
import Papa from "papaparse";

import { InstructionsModal } from "@/components/instructions-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { unzip } from "unzipit";
import {
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  Info,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function parse_json(content: string, filename: string) {
  if (filename.endsWith(".js")) {
    // Twitter takeouts are js instead of json files
    // We will only parse files in the data folder that consist of only a single variable definition
    // So, we remove the variable assignment, and try to parse the rest as json
    if (!filename.includes("data/")) return null;
    content = content.replace(/^.*? = /, "");
  }
  return JSON.parse(content);
}

function parse_csv(content: string, filename: string) {
  console.log(`Parsing CSV file ${filename}`);

  const parseResult = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  });

  if (parseResult.errors.length > 0) {
    console.warn(`CSV parsing warnings for ${filename}:`, parseResult.errors);
  }

  // Papaparse returns the data as a array of key:value dicts, so we can just return the first row
  return parseResult.data[0];
}

async function extract_json(file: File) {
  const fr = new FileReader();
  fr.readAsText(file);
  const jsonText = await file.text();
  const jsonContent = JSON.parse(jsonText);
  return [{ name: file.name, content: jsonContent }];
}

async function extract_zip(file: File) {
  const buffer = await file.arrayBuffer();
  const { entries } = await unzip(buffer);

  console.log("Zip loaded, found files:", Object.keys(entries).length);
  const jsonFiles: { name: string; content: any }[] = [];

  // Process each file in the zip
  const promises = Object.entries(entries).map(async ([filename, entry]) => {
    if (
      !(
        filename.endsWith(".json") ||
        filename.endsWith(".js") ||
        filename.endsWith(".csv")
      )
    )
      return;
    if (entry.isDirectory) return;

    try {
      const content = await entry.text();
      const jsonContent = filename.endsWith(".csv")
        ? parse_csv(content, filename)
        : parse_json(content, filename);
      if (jsonContent != null)
        jsonFiles.push({
          name: filename,
          content: jsonContent,
        });
      console.log({ filename, jsonContent });
      console.log(`Processed file: ${filename}`);
    } catch (e) {
      console.error(`Error parsing ${filename}:`, e);
    }
  });

  await Promise.all(promises);
  return jsonFiles;
}

export default function Home() {
  const [files, setFiles] = useState<{ name: string; content: any }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Add this to ensure console logs are visible
    console.log("Social Media Takeout Explorer loaded");
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    console.log("File upload triggered");
    handleNewFile(event.target.files?.[0]);
  };

  const handleNewFile = async (file?: File) => {
    console.log("Selected file:", file?.name);
    if (!file) return;

    if (!(file.name.endsWith(".zip") || file.name.endsWith(".json"))) {
      setError("Please load a zip or json file");
      return;
    }

    setIsLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFile(null);

    try {
      console.log(`Processing root file ${file.name}...`);
      const parser = file.name.endsWith(".zip") ? extract_zip : extract_json;
      const jsonFiles: { name: string; content: any }[] = await parser(file);

      if (jsonFiles.length === 0) {
        setError("No JSON files found in the zip");
      } else {
        console.log(`Found ${jsonFiles.length} JSON files`);
        setFiles(jsonFiles);
        setSelectedFile(jsonFiles[0].name);
      }
    } catch (e) {
      console.error("Error processing zip file:", e);
      setError("Error processing zip file. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    handleNewFile(file);
  };

  const selectedFileContent = selectedFile
    ? files.find((file) => file.name === selectedFile)?.content
    : null;

  const generateStructure = (obj: any): any => {
    if (obj == null) return "null";
    if (typeof obj !== "object") {
      return typeof obj;
    }
    if (Array.isArray(obj)) {
      return obj.length > 0 ? obj.map(generateStructure) : "emptyarray";
    }
    if (Object.keys(obj).length === 0) return "emptydict";

    const structure: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      structure[key] = generateStructure(value);
    }
    return structure;
  };

  const selectedStructure =
    selectedFileContent == null ? null : generateStructure(selectedFileContent);

  const handleDownloadStructure = useCallback(() => {
    const structure = files.reduce((acc, file) => {
      acc[file.name] = generateStructure(file.content);
      return acc;
    }, {} as Record<string, any>);

    const blob = new Blob([JSON.stringify(structure, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "json_structure.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [files]);

  return (
    <main className="container mx-auto py-8 px-4">
      {/* Responsive header - stacked on mobile, single row on desktop */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
        {/* Logos row on mobile, part of main row on desktop */}
        <div className="flex justify-between items-center md:w-auto">
          <Link href="https://vu.nl" target="_blank" rel="noopener noreferrer">
            <Image
              src="https://brandportal.vu.nl/public/app/pl?plc=7svqiOE6yLMf%2BjzgqYj9TUDekaGz%2FaDe6iD%2FbOkxh5XwT0d1Q6snZGfb8UdWP%2FwA"
              alt="Vrije Universiteit Amsterdam Logo"
              width={150}
              height={75}
              style={{ objectFit: "contain" }}
            />
          </Link>
          <div className="md:hidden">
            <Link
              href="https://what-if-horizon.eu/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="https://what-if-horizon.eu/wp-content/uploads/2025/01/wi-ci-logo.png?w=138&h=104"
                alt="WHAT-IF Logo"
                width={69}
                height={52}
                style={{ objectFit: "contain" }}
              />
            </Link>
          </div>
        </div>

        {/* Title and instructions row on mobile, part of main row on desktop */}
        <div className="flex justify-between items-center md:flex-1 md:ml-4">
          <h1 className="text-2xl font-bold">Social Media Takeout Explorer</h1>
          <div className="flex items-center gap-4">
            <InstructionsModal />
            <div className="hidden md:block">
              <Link
                href="https://what-if-horizon.eu/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="https://what-if-horizon.eu/wp-content/uploads/2025/01/wi-ci-logo.png?w=138&h=104"
                  alt="WHAT-IF Logo"
                  width={69}
                  height={52}
                  style={{ objectFit: "contain" }}
                />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded-md shadow-md">
        <div className="flex items-start">
          <Info className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <p>
            Please download your takeout data. You can find instructions for
            download the data{" "}
            <a
              href="https://donation-instructions.what-if-horizon.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              here
            </a>
            , or with the instructions button in the top. After downloading it,
            please load them in the "Load Takeout File" box. You can then
            download the structure file and mail it to us. The structure file
            contains only the information shown in the 'Structure' tab, so does
            not contain any content of your posts, messages etc.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(250px,300px)_1fr]">
        <div className="space-y-6 min-w-0 w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Load Takeout File</CardTitle>
              <CardDescription>
                Load the social media takeout file here. This is a .zip file you
                downloaded from the social media site. This file is kept on your
                computer and not uploaded to the researchers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center ${
                  isLoading ? "bg-muted" : ""
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <FileArchive className="h-10 w-10 text-muted-foreground animate-pulse" />
                      <p className="mt-2">Processing...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Drag & drop a zip file here, or click to browse
                      </p>
                      <input
                        type="file"
                        accept=".zip,.json"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                        key={files.length} // Add this to reset the input when files change
                      />
                      <Button asChild size="sm">
                        <label htmlFor="file-upload" className="cursor-pointer">
                          Browse Files
                        </label>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Files</CardTitle>
                <CardDescription>
                  {files.length} JSON/CSV file{files.length !== 1 ? "s" : ""}{" "}
                  found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto overflow-x-auto scrollbar-thin pr-2">
                  <div className="min-w-[200px]">
                    {files.map((file) => (
                      <Button
                        key={file.name}
                        variant={
                          selectedFile === file.name ? "default" : "outline"
                        }
                        className="w-full justify-start text-left mb-2 min-w-[200px]"
                        onClick={() => setSelectedFile(file.name)}
                      >
                        {file.name.endsWith(".csv") ? (
                          <FileSpreadsheet className="h-4 w-4 mr-2 flex-shrink-0" />
                        ) : (
                          <FileJson className="h-4 w-4 mr-2 flex-shrink-0" />
                        )}
                        <span className="truncate">{file.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {files.length > 0 && (
          <Card className="w-full min-w-0">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div>
                <CardTitle>File Structure Explorer</CardTitle>
                <CardDescription>
                  {selectedFile
                    ? `Selected file: ${selectedFile}`
                    : "Explore JSON structure"}
                </CardDescription>
              </div>
              <Button
                onClick={handleDownloadStructure}
                size="sm"
                className="self-start sm:self-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Structure
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="structure">
                <TabsList className="mb-4 overflow-x-auto scrollbar-thin">
                  <TabsTrigger value="structure">File Structure</TabsTrigger>
                  <TabsTrigger value="raw">Raw File Contents</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="structure"
                  className="max-h-[600px] overflow-y-auto"
                >
                  <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md">
                    <p className="text-sm">
                      This is the information that will be downloaded if you
                      select 'Download Structure'. It{" "}
                      <b>should not contain any private information</b> or file
                      content, only the structure of the files. If you see any
                      private information in the structure below, please let us
                      know and <b>do not email us the structure or file</b>
                    </p>
                  </div>
                  <div className="overflow-x-auto scrollbar-thin">
                    <pre className="p-4 border rounded-md bg-muted/30 text-sm whitespace-pre-wrap min-w-[300px]">
                      {JSON.stringify(selectedStructure, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
                <TabsContent
                  value="raw"
                  className="max-h-[600px] overflow-y-auto"
                >
                  <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md">
                    <p className="text-sm">
                      The raw JSON content is displayed for your information
                      only. We do not ask you to share this data with us or with
                      anyone, and this data is not included in the Structure
                      file you can download. This data is only displayed on your
                      computer and not stored or uploaded to any server.
                    </p>
                  </div>
                  <div className="overflow-x-auto scrollbar-thin">
                    <pre className="p-4 border rounded-md bg-muted/30 text-sm whitespace-pre-wrap min-w-[300px]">
                      {JSON.stringify(selectedFileContent, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
