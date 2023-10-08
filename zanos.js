const { insertAccount } = require("./db/account");
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
        /(localStorage|navigtor):\s*([\s\S]*?)(?=(localStorage|navigtor:|$))/g;
      let match;
      const extractedData = {};

      while ((match = regex.exec(fileContent)) !== null) {
        const key = match[1];
        const value = match[2].trim().split("\n")[0];
        extractedData[key] = value;
      }
      console.log(JSON.parse(extractedData.localStorage));
      console.log(`Добавлен файл ${file} в базу данных.`);

      // await insertAccount({
      //   username: Math.floor(Math.random() * 10 ** 10) + 10 ** 10,
      //   cookies: null,
      //   userAgent: extractedData.navigtor,
      //   localStorage: JSON.parse(extractedData.localStorage),
      //   testing: true
      // });
    }
  } catch (error) {
    console.error("Ошибка при обработке файлов:", error);
  }
};

// Вызываем функцию zanos
zanos().catch((error) => {
  console.error("Ошибка в функции zanos:", error);
});
