const fs = require("fs");
const path = require("path");

// Function to delete a file from the server
const deleteFileFromServer = (req, res) => {
  // Get the file path from the request body
  const { filePath } = req.body;

  //   console.log("filePath", filePath);

  if (!filePath) {
    return res.status(400).json({ message: "File path is required." });
  }

  // Create the absolute path to the file
  const fullFilePath = path.join(__dirname, "..", filePath);
  //   console.log("fullFilePath", fullFilePath);

  // Check if the file exists
  fs.access(fullFilePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ message: "File not found." });
    }

    // If the file exists, delete it
    fs.unlink(fullFilePath, (err) => {
      if (err) {
        console.error("Error deleting the file:", err);
        return res.status(500).json({ message: "Error deleting the file." });
      }

      return res.status(200).json({ message: "File deleted successfully." });
    });
  });
};

module.exports = deleteFileFromServer;
