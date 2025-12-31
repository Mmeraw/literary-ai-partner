import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function RichTextEditor({ value, onChange, placeholder, className, minHeight = "400px" }) {
    const modules = {
        toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'header': [1, 2, 3, false] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
        ]
    };

    const formats = [
        'bold', 'italic', 'underline',
        'header',
        'list', 'bullet'
    ];

    return (
        <div className={className}>
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                modules={modules}
                formats={formats}
                style={{ 
                    height: minHeight,
                    marginBottom: '60px'
                }}
            />
        </div>
    );
}