#!/bin/bash

# 获取当前目录名称
dir_name="./dist"
release_dir="./release"


for file in `ls ${dir_name}|grep 'docx-tmpl'`
do
    tar -zcvf "${release_dir}/${file}.tar.gz" "${dir_name}/${file}"
    if [ $? -ne 0 ]; then
        echo "${file} 打包失败"
        exit 1
    fi
done

sha256sum "${release_dir}"/*.tar.gz > "${release_dir}/sha256sum.txt"