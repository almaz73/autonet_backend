import {transporter} from "../nodemailer.js";
import {receivedDataTypes} from "../constants.js";

class Post {
    async postEmail(req, res) {
        try {
            const receivedData = req.body; // Данные находятся в req.body

            let result = await transporter.sendMail({
                from: 'autoset_info@cartat.ru',
                to: 'a.fayzrakhmanov@cartat.ru, ',
                subject: receivedDataTypes[receivedData.type],
                html:
                    '333 This <i>message</i> was sent from <strong>Node.js</strong> server.',
            });

            // Отправка ответа клиенту
            res.status(200).json({
                message: 'Данные успешно получены',
                data: result
            });
        } catch (error) {
            console.error('Error postEmail:', error);
            res.status(500).json({error: error.message});
        }

    }
    /*async postEmail(req, res) {

        console.log('111111111111 = ', 111111111111)
        try {
            const receivedData = req.body; // Данные находятся в req.body

            console.log('postEmail req.body= ', req.body)
            console.log('Тема письма = ', receivedDataTypes[receivedData.type])

            let result = await transporter.sendMail({
                from: 'autoset_info@cartat.ru',
                to: 'a.fayzrakhmanov@cartat.ru',
                subject: receivedDataTypes[receivedData.type],
                html: '!!!!! С обновленного сайта' + receivedData.text
            });

            console.log('УДАЧНО result = ', result)

            // Отправка ответа клиенту
            res.status(200).json({
                message: 'Данные успешно получены. Почта',
                data: result
            });
        } catch (error) {
            console.error('Error postEmail:', error);
            res.status(500).json({error: error.message});
        }

    }*/

    async postEmailWithAttachement(req, res) {
        try {
            console.log('postEmailWithAttachement req= ', req)
            // Check if file was uploaded
            if (!req.file) return res.status(400).json({error: 'No file uploaded'});


            // Log file information
            console.log('УДАЧА File info:', {
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });

            const receivedData = req.body;
            console.log('Received data:', receivedData);

            // Prepare email with attachment
            let mailOptions = {
                from: 'autoset_info@cartat.ru',
                to: 'a.fayzrakhmanov@cartat.ru',
                subject: receivedData.subject || 'Email with attachment',
                text: receivedData.text || 'Email with attachment',
                html: receivedData.html || '<p>Email with attachment</p>',
                attachments: [
                    {
                        filename: req.file.originalname,
                        content: req.file.buffer,
                        contentType: req.file.mimetype
                    }
                ]
            };

            // Send email with attachment
            let result = await transporter.sendMail(mailOptions);

            // Send response to client
            res.status(200).json({
                message: 'Email with attachment sent successfully',
                data: {
                    fileInfo: {
                        originalName: req.file.originalname,
                        size: req.file.size,
                        mimetype: req.file.mimetype
                    },
                    emailResult: result
                }
            });
        } catch (error) {
            console.error('Error postEmailWithAttachement:', error);

            // Handle specific multer errors
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'File too large. Maximum size is 10MB.'
                });
            }

            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    error: 'Unexpected file field. Expected field name is "file".'
                });
            }

            res.status(500).json({error: error.message});
        }
    }
}

export default new Post();