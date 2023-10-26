const { insertAccount2 } = require("./db/account");
const fs = require("fs");
const path = require("path");

const zanos = async () => {
  // Получаем список файлов внутри папки ./output
  const outputFolderPath = "./output";
  try {
    const files = await fs.promises.readdir(outputFolderPath);

    // Итерируемся по файлам и получаем их контент
    for (const file of files) {
      const filePath = path.join(outputFolderPath, file);

      // Читаем контент файла
      const fileContent = await fs.promises.readFile(filePath, "utf-8");

      // Используем регулярное выражение для извлечения значений
      const regex =
        /(localStorage|navigtor|username):\s*([\s\S]*?)(?=(localStorage|navigtor|username:|$))/g;
      let match;
      const extractedData = {};

      while ((match = regex.exec(fileContent)) !== null) {
        const key = match[1];
        const value = match[2].trim().split("\n")[0];
        extractedData[key] = value;
      }

      console.log(`${extractedData.username} добавлен в базу данных.`);

      await insertAccount2({
        username: extractedData.username,
        cookies: null,
        userAgent: extractedData.navigtor,
        localStorage: JSON.parse(extractedData.localStorage),
      });
    }
  } catch (error) {
    console.error("Ошибка при обработке файлов:", error);
  }
};

// Вызываем функцию zanos
zanos().catch((error) => {
  console.error("Ошибка в функции zanos:", error);
});
